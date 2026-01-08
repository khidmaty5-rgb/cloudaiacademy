'use client';

import { format } from 'date-fns';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import QRCode from 'qrcode';
import type { Certificate } from '@/types/models';
import { trimImageToPngDataUrl } from '@/lib/image-trim';

function toDateValue(v: any): Date | null {
  if (!v) return null;
  if (typeof v?.toDate === 'function') return v.toDate();
  if (v instanceof Date) return v;
  if (typeof v === 'number') return new Date(v);
  if (typeof v === 'string') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  // Avoid stale 404s or cached assets while iterating on images in dev.
  const resp = await fetch(url, { cache: 'no-store' });
  if (!resp.ok) {
    throw new Error(`Failed to fetch ${url} (${resp.status})`);
  }
  const ab = await resp.arrayBuffer();
  return new Uint8Array(ab);
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',');
  if (comma === -1) throw new Error('Invalid data URL');
  const base64 = dataUrl.slice(comma + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function renderTextToPngDataUrl(
  text: string,
  options: {
    fontFamily: string;
    fontSize: number;
    color?: string;
    paddingX?: number;
    paddingY?: number;
    scale?: number;
  },
): string | null {
  if (typeof document === 'undefined') return null;
  const safeText = String(text || '').trim();
  if (!safeText) return null;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const paddingX = options.paddingX ?? 8;
  const paddingY = options.paddingY ?? 8;
  const scale = Math.max(1, options.scale ?? 3);
  const font = `${options.fontSize}px ${options.fontFamily}`;

  ctx.font = font;
  ctx.textBaseline = 'alphabetic';
  const metrics = ctx.measureText(safeText);
  const ascent = metrics.actualBoundingBoxAscent || options.fontSize * 0.8;
  const descent = metrics.actualBoundingBoxDescent || options.fontSize * 0.2;

  const logicalWidth = Math.ceil(metrics.width + paddingX * 2);
  const logicalHeight = Math.ceil(ascent + descent + paddingY * 2);

  canvas.width = Math.max(1, Math.ceil(logicalWidth * scale));
  canvas.height = Math.max(1, Math.ceil(logicalHeight * scale));

  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, logicalWidth, logicalHeight);
  ctx.font = font;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = options.color ?? '#142E4D';
  ctx.fillText(safeText, paddingX, paddingY + ascent);

  return canvas.toDataURL('image/png');
}

function wrapText(
  text: string,
  options: {
    font: any;
    fontSize: number;
    maxWidth: number;
    maxLines?: number;
  },
): string[] {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];

  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    const w = options.font.widthOfTextAtSize(next, options.fontSize);
    if (w <= options.maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (options.maxLines && lines.length >= options.maxLines) break;
  }

  if (current && (!options.maxLines || lines.length < options.maxLines)) {
    lines.push(current);
  }

  if (options.maxLines && lines.length > options.maxLines) {
    return lines.slice(0, options.maxLines);
  }
  return lines;
}

function fitFontSizeToWidth(options: {
  text: string;
  font: any;
  maxWidth: number;
  startSize: number;
  minSize: number;
}) {
  let size = options.startSize;
  const safeText = String(options.text || '');
  while (size > options.minSize) {
    const w = options.font.widthOfTextAtSize(safeText, size);
    if (w <= options.maxWidth) break;
    size -= 1;
  }
  return size;
}

export type CertificatePdfOptions = {
  certificate: Certificate;
  verifyUrl: string;
  /**
   * Background PDF template to draw on top of (first page is used).
   * If omitted, a generated printable layout is used.
   * Place the file in /public and pass its public path, e.g. `/CloudAI_Certificate1.pdf`.
   */
  templatePdfUrl?: string | null;
  logoUrl?: string;
  /**
   * Optional stamp/seal image (PNG/JPG) for the "VERIFIED" badge area in the generated layout.
   * Place it in `/public/images` and pass its public path, e.g. `/images/verified-stamp.png`.
   * If omitted or the image can't be loaded, a simple vector badge is drawn instead.
   */
  verifiedStampUrl?: string | null;
  /**
   * When true, PDF generation throws if `verifiedStampUrl` is provided but can't be loaded/embedded.
   * Useful for debugging missing static assets in dev.
   */
  strictVerifiedStamp?: boolean;
  /**
   * Optional signature image (PNG/JPG) for the Authorized Signature.
   * When provided, it's used unless overridden by `authorizedSignatureImageUrl`.
   *
   * Recommended: a transparent PNG trimmed tightly around the signature.
   */
  signatureImageUrl?: string | null;
  /** Optional signature image for the Authorized Signature. */
  authorizedSignatureImageUrl?: string | null;
};

export async function generateCertificatePdfBytes({
  certificate,
  verifyUrl,
  templatePdfUrl = null,
  logoUrl = '/images/certificateLog.png',
  verifiedStampUrl = '/images/stamp.png',
  strictVerifiedStamp = false,
  signatureImageUrl = null,
  authorizedSignatureImageUrl = null,
}: CertificatePdfOptions): Promise<Uint8Array> {
  let pdfDoc: PDFDocument;
  let page: any;
  let usingTemplate = false;

  if (templatePdfUrl) {
    try {
      const templateBytes = await fetchBytes(templatePdfUrl);
      pdfDoc = await PDFDocument.load(templateBytes);
      page = pdfDoc.getPage(0);
      usingTemplate = true;
    } catch {
      pdfDoc = await PDFDocument.create();
      // A4 landscape in points.
      page = pdfDoc.addPage([842, 595]);
    }
  } else {
    pdfDoc = await PDFDocument.create();
    // A4 landscape in points.
    page = pdfDoc.addPage([842, 595]);
  }

  const { width, height } = page.getSize();

  const serif = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const sans = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const sigFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const recipientNameStyle:
    | 'CALLIGRAPHY'
    | 'GABRIOLA'
    | 'EDWARDIAN'
    | 'FRENCH_SCRIPT'
    | 'SERIF'
    | 'SANS' = (() => {
    const raw = (certificate as any)?.recipientNameStyle as string | undefined;
    return raw === 'SERIF' ||
      raw === 'SANS' ||
      raw === 'CALLIGRAPHY' ||
      raw === 'GABRIOLA' ||
      raw === 'EDWARDIAN' ||
      raw === 'FRENCH_SCRIPT'
      ? raw
      : 'CALLIGRAPHY';
  })();

  const borderColor = rgb(0.08, 0.18, 0.30);
  const accentColor = rgb(0.85, 0.65, 0.10);

  const drawCentered = (text: string, y: number, opts: { font: any; size: number; color?: any }) => {
    const safeText = String(text ?? '');
    const w = opts.font.widthOfTextAtSize(safeText, opts.size);
    page.drawText(safeText, {
      x: width / 2 - w / 2,
      y,
      size: opts.size,
      font: opts.font,
      color: opts.color ?? rgb(0, 0, 0),
    });
  };

  const completedAt = toDateValue(certificate.completedAt);
  const completedLabel = completedAt ? format(completedAt, 'MMMM yyyy') : '—';

  const tryEmbedImage = async (src?: string | null, opts?: { label?: string; warnOnError?: boolean }) => {
    if (!src) return null;
    try {
      let effectiveSrc = src;
      if (!effectiveSrc.startsWith('data:') && effectiveSrc.toLowerCase().includes('/signature')) {
        const trimmed = await trimImageToPngDataUrl(effectiveSrc);
        if (trimmed) effectiveSrc = trimmed;
      }

      const bytes = effectiveSrc.startsWith('data:') ? dataUrlToBytes(effectiveSrc) : await fetchBytes(effectiveSrc);
      try {
        return await pdfDoc.embedPng(bytes);
      } catch {
        return await pdfDoc.embedJpg(bytes);
      }
    } catch (err: unknown) {
      if (opts?.warnOnError && typeof console !== 'undefined') {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[certificate-pdf] failed to embed image${opts.label ? ` (${opts.label})` : ''}: ${src}`, msg);
      }
      return null;
    }
  };

  const tryEmbedFirstImage = async (
    sources: Array<string | null | undefined>,
    opts?: { label?: string; warnOnError?: boolean },
  ) => {
    for (const src of sources) {
      const img = await tryEmbedImage(src, opts);
      if (img) return img;
    }
    return null;
  };

  const authorizedSignatureImage = await tryEmbedFirstImage([
    authorizedSignatureImageUrl,
    signatureImageUrl,
    '/images/signature_2.png',
    '/images/signature.png',
    '/images/signature2.png',
  ]);

  const signatureTextFontFamily =
    '"Monotype Corsiva","Segoe Script","Brush Script MT","Lucida Handwriting","Apple Chancery",cursive';

  const renderSignatureTextImage = async (text: string) => {
    try {
      const dataUrl = renderTextToPngDataUrl(text, {
        fontFamily: signatureTextFontFamily,
        fontSize: 48,
        paddingX: 6,
        paddingY: 10,
        scale: 4,
        color: '#142E4D',
      });
      if (!dataUrl) return null;
      const bytes = dataUrlToBytes(dataUrl);
      return await pdfDoc.embedPng(bytes);
    } catch {
      return null;
    }
  };

  const recipientNameTextFontFamily = (() => {
    switch (recipientNameStyle) {
      case 'GABRIOLA':
        return '"Gabriola","Monotype Corsiva","Segoe Script","Lucida Handwriting","Apple Chancery",cursive';
      case 'EDWARDIAN':
        return '"Edwardian Script ITC","Kunstler Script","French Script MT","Segoe Script","Apple Chancery",cursive';
      case 'FRENCH_SCRIPT':
        return '"French Script MT","Kunstler Script","Edwardian Script ITC","Segoe Script","Apple Chancery",cursive';
      default:
        return '"Monotype Corsiva","Edwardian Script ITC","Segoe Script","Brush Script MT","Lucida Handwriting","Apple Chancery",cursive';
    }
  })();

  const renderRecipientNameTextImage = async (text: string) => {
    try {
      const safe = String(text || '').trim();
      if (!safe) return null;
      const dataUrl = renderTextToPngDataUrl(safe, {
        fontFamily: recipientNameTextFontFamily,
        fontSize: 96,
        paddingX: 14,
        paddingY: 12,
        scale: 4,
        color: '#142E4D',
      });
      if (!dataUrl) return null;
      const bytes = dataUrlToBytes(dataUrl);
      return await pdfDoc.embedPng(bytes);
    } catch {
      return null;
    }
  };

  const isRecipientNameScript =
    recipientNameStyle === 'CALLIGRAPHY' ||
    recipientNameStyle === 'GABRIOLA' ||
    recipientNameStyle === 'EDWARDIAN' ||
    recipientNameStyle === 'FRENCH_SCRIPT';

  const recipientNameTextImage = isRecipientNameScript
    ? await renderRecipientNameTextImage(String(certificate.userName || ''))
    : null;

  const authorizedSignatureTextImage = authorizedSignatureImage
    ? null
    : await renderSignatureTextImage(String(certificate.authorizedByName || 'Fateh Adhnouss'));

  const logoImage = await tryEmbedImage(logoUrl);
  const verifiedStampImage = usingTemplate
    ? null
    : await tryEmbedFirstImage(
        [
          verifiedStampUrl,
          '/images/stamp.png',
          '/images/verified-stamp.png',
          '/images/cccc.png',
        ],
        { label: 'verifiedStamp', warnOnError: true },
      );
  if (!usingTemplate && strictVerifiedStamp && verifiedStampUrl && !verifiedStampImage) {
    throw new Error(
      `Verified stamp image could not be loaded at "${verifiedStampUrl}". ` +
        `Place it under /public (e.g. public${verifiedStampUrl}) and confirm it opens in the browser.`,
    );
  }

  // Draw on top of a background template.
  if (usingTemplate) {
    const isCloudAiTemplate = Math.abs(width - 1536) < 8 && Math.abs(height - 1024) < 8;

    const refWidth = isCloudAiTemplate ? 1536 : 842;
    const refHeight = isCloudAiTemplate ? 1024 : 595;
    const scaleX = width / refWidth;
    const scaleY = height / refHeight;
    const squareScale = Math.min(scaleX, scaleY);
    const toX = (x: number) => x * scaleX;
    const toY = (y: number) => y * scaleY;

    const nameMaxWidth = width - toX(2 * (36 + 40));
    const nameY = isCloudAiTemplate ? toY(585) : toY(340);
    const nameText = String(certificate.userName || '—');
    const nameFont = recipientNameStyle === 'SANS' ? sansBold : serifBold;
    const nameSize = fitFontSizeToWidth({
      text: nameText,
      font: nameFont,
      maxWidth: nameMaxWidth,
      startSize: Math.round(42 * scaleY),
      minSize: Math.round(24 * scaleY),
    });

    if (isRecipientNameScript && recipientNameTextImage) {
      const maxH = Math.max(Math.round(64 * scaleY), Math.round(nameSize * 1.8));
      const centerY = nameY + nameSize * 0.35;
      const scale = Math.min(nameMaxWidth / recipientNameTextImage.width, maxH / recipientNameTextImage.height, 1);
      const w = Math.max(1, recipientNameTextImage.width * scale);
      const h = Math.max(1, recipientNameTextImage.height * scale);
      page.drawImage(recipientNameTextImage, {
        x: width / 2 - w / 2,
        y: centerY - h / 2,
        width: w,
        height: h,
      });
    } else {
      drawCentered(nameText, nameY, {
        font: nameFont,
        size: nameSize,
        color: borderColor,
      });
    }

    // Course title (wrap to 2 lines)
    const courseBoxWidth = width - toX(2 * (36 + 60));
    const courseFontSize = Math.round(24 * scaleY);
    const courseLineSpacing = (isCloudAiTemplate ? 48 : 28) * scaleY;
    const courseLines = wrapText(String(certificate.courseTitle || '—'), {
      font: serifBold,
      fontSize: courseFontSize,
      maxWidth: courseBoxWidth,
      maxLines: 2,
    });
    const courseYTop = isCloudAiTemplate ? toY(439) : toY(255);
    courseLines.forEach((line, idx) => {
      drawCentered(line, courseYTop - idx * courseLineSpacing, {
        font: serifBold,
        size: courseFontSize,
        color: borderColor,
      });
    });

    // Details (values only; template usually already has labels)
    const detailsY = isCloudAiTemplate ? toY(371) : toY(192);
    const detailsFontSize = Math.round(14 * scaleY);
    const detailsColor = rgb(0.15, 0.18, 0.22);

    const drawValueCenteredAt = (text: string, x: number, y: number, opts: { font: any; size: number; color?: any }) => {
      const safeText = String(text ?? '');
      const w = opts.font.widthOfTextAtSize(safeText, opts.size);
      page.drawText(safeText, {
        x: x - w / 2,
        y,
        size: opts.size,
        font: opts.font,
        color: opts.color ?? rgb(0, 0, 0),
      });
    };

    if (isCloudAiTemplate) {
      // Detected from cert-template-img-000.png line segments (y=661px from top).
      const dateSize = fitFontSizeToWidth({
        text: completedLabel,
        font: sans,
        maxWidth: toX(146),
        startSize: detailsFontSize,
        minSize: Math.max(10, Math.round(10 * scaleY)),
      });
      drawValueCenteredAt(completedLabel, toX(420.5), detailsY, {
        font: sans,
        size: dateSize,
        color: detailsColor,
      });
      drawValueCenteredAt(String(certificate.totalHours), toX(740), detailsY, {
        font: sans,
        size: detailsFontSize,
        color: detailsColor,
      });
      const idSize = fitFontSizeToWidth({
        text: certificate.id,
        font: sansBold,
        maxWidth: toX(309),
        startSize: detailsFontSize,
        minSize: Math.max(9, Math.round(9 * scaleY)),
      });
      drawValueCenteredAt(String(certificate.id || '—'), toX(1192), detailsY, {
        font: sansBold,
        size: idSize,
        color: borderColor,
      });
    } else {
      drawValueCenteredAt(completedLabel, toX(244), detailsY, {
        font: sans,
        size: detailsFontSize,
        color: detailsColor,
      });
      drawValueCenteredAt(String(certificate.totalHours), toX(446), detailsY, {
        font: sans,
        size: detailsFontSize,
        color: detailsColor,
      });
      const idSize = fitFontSizeToWidth({
        text: certificate.id,
        font: sansBold,
        maxWidth: toX(260),
        startSize: Math.round(14 * scaleY),
        minSize: Math.round(10 * scaleY),
      });
      drawValueCenteredAt(String(certificate.id || '—'), toX(665), detailsY, {
        font: sansBold,
        size: idSize,
        color: borderColor,
      });
    }

    // Verify URL (centered; if your template already prints the base URL, remove this and place only the ID).
    const verifyLines = wrapText(String(verifyUrl || ''), {
      font: sans,
      fontSize: Math.round(10 * scaleY),
      maxWidth: isCloudAiTemplate ? toX(980) : width - toX(2 * 80),
      maxLines: 2,
    });
    verifyLines.forEach((line, idx) => {
      drawCentered(line, (isCloudAiTemplate ? toY(250) : toY(115)) - idx * (14 * scaleY), {
        font: sans,
        size: Math.round(10 * scaleY),
        color: rgb(0.22, 0.25, 0.30),
      });
    });

    // Signature names (values only; template usually has lines + titles)
    if (isCloudAiTemplate) {
      // Detected from cert-template-img-000.png signature lines (y=842px from top).
      const sigNameY = toY(204);
      const authorizedMaxW = toX(270);
      const authorizedMaxH = toY(70) - toY(0);
      const authorizedSigImage = authorizedSignatureImage || authorizedSignatureTextImage;
      if (authorizedSigImage) {
        const scale = Math.min(
          authorizedMaxW / authorizedSigImage.width,
          authorizedMaxH / authorizedSigImage.height,
        );
        const w = authorizedSigImage.width * scale;
        const h = authorizedSigImage.height * scale;
        page.drawImage(authorizedSigImage, {
          x: toX(1148.5) - w / 2,
          y: sigNameY - 10 * scaleY,
          width: w,
          height: h,
        });
      } else {
        const authorizedSize = fitFontSizeToWidth({
          text: certificate.authorizedByName || 'Fateh Adhnouss',
          font: sigFont,
          maxWidth: authorizedMaxW,
          startSize: Math.round(18 * scaleY),
          minSize: Math.round(12 * scaleY),
        });
        drawValueCenteredAt(String(certificate.authorizedByName || 'Fateh Adhnouss'), toX(1148.5), sigNameY - 10 * scaleY, {
          font: sigFont,
          size: authorizedSize,
          color: borderColor,
        });
      }
    } else {
      page.drawText(String(certificate.authorizedByName || 'Fateh Adhnouss'), {
        x: toX(496),
        y: toY(92),
        size: Math.round(18 * scaleY),
        font: serif,
        color: borderColor,
      });
    }

    // QR code (bottom-right; sized/positioned relative to template)
    try {
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 0, width: 512 });
      const qrBytes = dataUrlToBytes(qrDataUrl);
      const qr = await pdfDoc.embedPng(qrBytes);
      if (isCloudAiTemplate) {
        // QR placeholder box detected from cert-template-img-000.png
        // (left=1303, right=1436, top=788, bottom=920 in image pixels).
        const boxLeft = toX(1303);
        const boxRight = toX(1436);
        const boxTop = toY(236);
        const boxBottom = toY(104);
        const pad = 10 * squareScale;
        const qrSize = Math.max(24, Math.min(boxRight - boxLeft, boxTop - boxBottom) - pad * 2);
        page.drawImage(qr, {
          x: boxLeft + (boxRight - boxLeft - qrSize) / 2,
          y: boxBottom + (boxTop - boxBottom - qrSize) / 2,
          width: qrSize,
          height: qrSize,
        });
      } else {
        const qrSize = 92 * squareScale;
        const qrX = toX(700);
        const qrY = toY(61);
        page.drawRectangle({
          x: qrX,
          y: qrY,
          width: qrSize + 14 * squareScale,
          height: qrSize + 14 * squareScale,
          color: rgb(1, 1, 1),
          borderColor: rgb(0.82, 0.84, 0.88),
          borderWidth: 1,
        });
        page.drawImage(qr, {
          x: qrX + 7 * squareScale,
          y: qrY + 7 * squareScale,
          width: qrSize,
          height: qrSize,
        });
      }
    } catch {
      // ignore QR errors
    }

    return pdfDoc.save();
  }

  // Fallback: generate a fully-styled certificate without a template.
  {
    const margin = 36;
    const innerInset = 10;
    const safeInset = margin + innerInset + 20;

    const safeLeft = safeInset;
    const safeRight = width - safeInset;
    const safeTop = height - safeInset;
    const safeBottom = safeInset;
    const safeWidth = safeRight - safeLeft;
    const centerX = width / 2;

    const mutedText = rgb(0.40, 0.45, 0.55);
    const lineColor = rgb(0.78, 0.80, 0.84);
    const panelFill = rgb(0.985, 0.988, 0.995);

    const drawCenteredAtX = (text: string, x: number, y: number, opts: { font: any; size: number; color?: any }) => {
      const safeText = String(text ?? '');
      const w = opts.font.widthOfTextAtSize(safeText, opts.size);
      page.drawText(safeText, {
        x: x - w / 2,
        y,
        size: opts.size,
        font: opts.font,
        color: opts.color ?? rgb(0, 0, 0),
      });
    };

    // Paper + decorative frame (print-safe margins)
    page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });
    page.drawRectangle({
      x: margin + innerInset,
      y: margin + innerInset,
      width: width - 2 * (margin + innerInset),
      height: height - 2 * (margin + innerInset),
      color: panelFill,
    });
    page.drawRectangle({
      x: margin,
      y: margin,
      width: width - margin * 2,
      height: height - margin * 2,
      borderColor,
      borderWidth: 3,
    });
    page.drawRectangle({
      x: margin + innerInset,
      y: margin + innerInset,
      width: width - 2 * (margin + innerInset),
      height: height - 2 * (margin + innerInset),
      borderColor: accentColor,
      borderWidth: 1.5,
    });

    // Watermark (subtle, print-safe)
    if (logoImage) {
      const maxW = safeWidth * 0.56;
      const maxH = (safeTop - safeBottom) * 0.56;
      const scale = Math.min(maxW / logoImage.width, maxH / logoImage.height);
      const w = Math.max(1, logoImage.width * scale);
      const h = Math.max(1, logoImage.height * scale);
      page.drawImage(logoImage, {
        x: centerX - w / 2,
        y: height / 2 - h / 2,
        width: w,
        height: h,
        opacity: 0.15,
      });
    } else {
      const watermarkText = 'CLOUDAI ACADEMY';
      const watermarkSize = fitFontSizeToWidth({
        text: watermarkText,
        font: sansBold,
        maxWidth: width * 1.1,
        startSize: 120,
        minSize: 72,
      });
      const watermarkW = sansBold.widthOfTextAtSize(watermarkText, watermarkSize);
      page.drawText(watermarkText, {
        x: centerX - watermarkW / 2,
        y: height / 2 - watermarkSize / 2,
        size: watermarkSize,
        font: sansBold,
        color: borderColor,
        opacity: 0.06,
        rotate: degrees(20),
      });
    }

    // Header: logo + brand
    {
      const logoBox = 52;
      const logoY = safeTop - logoBox;
      if (logoImage) {
        const scale = Math.min(logoBox / logoImage.width, logoBox / logoImage.height);
        const w = Math.max(1, logoImage.width * scale);
        const h = Math.max(1, logoImage.height * scale);
        page.drawImage(logoImage, {
          x: centerX - w / 2,
          y: logoY + (logoBox - h) / 2,
          width: w,
          height: h,
        });
      }

      drawCenteredAtX('CLOUDAI ACADEMY', centerX, logoY - 14, {
        font: sans,
        size: 9,
        color: mutedText,
      });
    }

    // Title
    const titleText = 'CERTIFICATE OF COMPLETION';
    const titleSize = fitFontSizeToWidth({
      text: titleText,
      font: sansBold,
      maxWidth: safeWidth,
      startSize: 48,
      minSize: 34,
    });
    drawCenteredAtX(titleText, centerX, 420, { font: sansBold, size: titleSize, color: borderColor });

    // Keep clear separation from the name box (avoid clipped overlap on some PDF renderers).
    drawCenteredAtX('This certificate is proudly presented to', centerX, 402, {
      font: sans,
      size: 14,
      color: mutedText,
    });

    // Recipient name box
    const nameBoxH = 60;
    const nameBoxY = 330;

    const nameText = String(certificate.userName || '—');
    const nameFont = recipientNameStyle === 'SERIF' ? serifBold : sansBold;

    if (isRecipientNameScript && recipientNameTextImage) {
      const nameMaxW = safeWidth - 72;
      const nameMaxH = nameBoxH - 14;
      const scale = Math.min(
        nameMaxW / recipientNameTextImage.width,
        nameMaxH / recipientNameTextImage.height,
        1,
      );
      const w = Math.max(1, recipientNameTextImage.width * scale);
      const h = Math.max(1, recipientNameTextImage.height * scale);
      page.drawImage(recipientNameTextImage, {
        x: centerX - w / 2,
        y: nameBoxY + (nameBoxH - h) / 2,
        width: w,
        height: h,
      });
    } else {
      const fittedNameSize = fitFontSizeToWidth({
        text: nameText,
        font: nameFont,
        maxWidth: safeWidth - 72,
        startSize: 38,
        minSize: 20,
      });
      drawCenteredAtX(nameText, centerX, nameBoxY + nameBoxH / 2 - fittedNameSize * 0.35, {
        font: nameFont,
        size: fittedNameSize,
        color: borderColor,
      });
    }

    drawCenteredAtX('for successfully completing the course:', centerX, 318, {
      font: sans,
      size: 14,
      color: mutedText,
    });

    // Course box
    const courseBoxH = 64;
    const courseBoxY = 244;

    const coursePaddingX = 26;
    const courseMaxWidth = safeWidth - 40 - coursePaddingX * 2;
    let courseTextSize = 26;
    let courseLines: string[] = [];
    const courseLineGap = 4;
    const coursePaddingY = 6;
    const courseAvailableHeight = courseBoxH - coursePaddingY * 2;
    for (; courseTextSize >= 12; courseTextSize -= 1) {
      courseLines = wrapText(String(certificate.courseTitle || '—'), {
        font: sansBold,
        fontSize: courseTextSize,
        maxWidth: courseMaxWidth,
      });
      const contentHeight = courseLines.length * courseTextSize + Math.max(0, courseLines.length - 1) * courseLineGap;
      if (courseLines.length <= 2 && contentHeight <= courseAvailableHeight) break;
    }
    if (courseLines.length > 2) courseLines = courseLines.slice(0, 2);
    const courseLineStep = courseTextSize + courseLineGap;
    const courseFirstY =
      courseBoxY +
      courseBoxH / 2 +
      ((courseLines.length - 1) * courseLineStep) / 2 -
      courseTextSize * 0.35;
    courseLines.forEach((line, idx) => {
      drawCenteredAtX(line, centerX, courseFirstY - idx * courseLineStep, {
        font: sansBold,
        size: courseTextSize,
        color: borderColor,
      });
    });

    // Details row (fit to width)
    const detailsParts: Array<{ label: string; value: string; valueFont: any; valueColor?: any }> = [
      { label: 'Completion date:', value: completedLabel, valueFont: sans },
      { label: 'Total hours:', value: String(certificate.totalHours), valueFont: sans },
      { label: 'Certificate ID:', value: String(certificate.id || '—'), valueFont: sansBold, valueColor: borderColor },
    ];

    const sep = '   |   ';
    let detailsSize = 12;
    const detailsMinSize = 8;
    const calcDetailsWidth = (size: number) => {
      let total = 0;
      detailsParts.forEach((p, idx) => {
        total += sans.widthOfTextAtSize(`${p.label} `, size);
        total += p.valueFont.widthOfTextAtSize(p.value, size);
        if (idx < detailsParts.length - 1) total += sans.widthOfTextAtSize(sep, size);
      });
      return total;
    };
    while (detailsSize > detailsMinSize && calcDetailsWidth(detailsSize) > safeWidth) {
      detailsSize -= 1;
    }

    const detailsY = 232;
    const detailsTotalWidth = calcDetailsWidth(detailsSize);
    let cursorX = centerX - detailsTotalWidth / 2;
    for (let i = 0; i < detailsParts.length; i += 1) {
      const p = detailsParts[i];
      const labelText = `${p.label} `;
      page.drawText(labelText, {
        x: cursorX,
        y: detailsY,
        size: detailsSize,
        font: sans,
        color: mutedText,
      });
      cursorX += sans.widthOfTextAtSize(labelText, detailsSize);

      page.drawText(p.value, {
        x: cursorX,
        y: detailsY,
        size: detailsSize,
        font: p.valueFont,
        color: p.valueColor ?? rgb(0.10, 0.12, 0.15),
      });
      cursorX += p.valueFont.widthOfTextAtSize(p.value, detailsSize);

      if (i < detailsParts.length - 1) {
        page.drawText(sep, {
          x: cursorX,
          y: detailsY,
          size: detailsSize,
          font: sans,
          color: mutedText,
        });
        cursorX += sans.widthOfTextAtSize(sep, detailsSize);
      }
    }

    // Issued by + separator + verify URL
    const issuedByText = `Issued by ${certificate.issuedBy || 'CloudAI Academy'}`;
    drawCenteredAtX(issuedByText, centerX, 210, { font: sansBold, size: 14, color: borderColor });
    page.drawLine({
      start: { x: safeLeft, y: 196 },
      end: { x: safeRight, y: 196 },
      thickness: 1,
      color: rgb(0.86, 0.88, 0.92),
    });

    const qrSize = 80;
    const qrPad = 8;
    const qrBoxSize = qrSize + qrPad * 2;
    const qrBoxX = safeRight - qrBoxSize;
    const qrBoxY = safeBottom + 2;

    const verifyAreaRight = qrBoxX - 14;
    const verifyCenterX = (safeLeft + verifyAreaRight) / 2;
    const verifyMaxWidth = Math.max(240, verifyAreaRight - safeLeft);
    const verifyLines = wrapText(String(verifyUrl || ''), {
      font: sans,
      fontSize: 10,
      maxWidth: verifyMaxWidth,
      maxLines: 2,
    });
    const verifyStartY = 184;
    verifyLines.forEach((line, idx) => {
      drawCenteredAtX(line, verifyCenterX, verifyStartY - idx * 14, {
        font: sans,
        size: 10,
        color: mutedText,
      });
    });

    // Footer: signatures + QR
    const sigBlockOffsetY = 15;
    const sigLineY = safeBottom + sigBlockOffsetY;
    const sigLineW = 240;
    const sigLineH = 1.2;

    // Verified stamp / badge
    const badgeX = safeLeft + 34;
    const badgeCenterY = qrBoxY + qrBoxSize / 4 + 14;
    if (verifiedStampImage) {
      const maxSize = 120;
      const scale = Math.min(maxSize / verifiedStampImage.width, maxSize / verifiedStampImage.height);
      const w = Math.max(1, verifiedStampImage.width * scale);
      const h = Math.max(1, verifiedStampImage.height * scale);
      page.drawImage(verifiedStampImage, {
        x: badgeX - w / 2,
        y: badgeCenterY - h / 2,
        width: w,
        height: h,
      });
    } else {
      const badgeRadius = 26;
      page.drawCircle({
        x: badgeX,
        y: badgeCenterY,
        size: badgeRadius,
        borderColor: accentColor,
        borderWidth: 3,
        color: rgb(1, 1, 1),
      });
      drawCenteredAtX('VERIFIED', badgeX, badgeCenterY - 4, {
        font: sansBold,
        size: 7.5,
        color: accentColor,
      });
    }

    const drawSignature = async (options: {
      name: string;
      title: string;
      lineX: number;
      nameCenterX: number;
      titleAlign: 'left' | 'right' | 'center';
      image: any | null;
      imageMaxH?: number;
      imageYOffset?: number;
    }) => {
      const lineY = sigLineY + 10;
      const imageMaxW = sigLineW;
      const imageMaxH = options.imageMaxH ?? 100;
      const imageBottomY = lineY + 4 + (options.imageYOffset ?? 0);

      if (options.image) {
        const scale = Math.min(imageMaxW / options.image.width, imageMaxH / options.image.height);
        const w = options.image.width * scale;
        const h = options.image.height * scale;
        page.drawImage(options.image, {
          x: options.nameCenterX - w / 2,
          y: imageBottomY,
          width: w,
          height: h,
        });
      } else {
        const nameSize = fitFontSizeToWidth({
          text: options.name,
          font: sigFont,
          maxWidth: sigLineW,
          startSize: 18,
          minSize: 12,
        });
        drawCenteredAtX(options.name, options.nameCenterX, sigLineY + 18, {
          font: sigFont,
          size: nameSize,
          color: borderColor,
        });
      }

      page.drawRectangle({ x: options.lineX, y: lineY, width: sigLineW, height: sigLineH, color: lineColor });

      const titleText = String(options.title || '');
      if (options.titleAlign === 'right') {
        page.drawText(titleText, {
          x: options.lineX + sigLineW - sans.widthOfTextAtSize(titleText, 10),
          y: sigLineY - 8,
          size: 10,
          font: sans,
          color: mutedText,
        });
      } else if (options.titleAlign === 'center') {
        const w = sans.widthOfTextAtSize(titleText, 10);
        page.drawText(titleText, {
          x: options.lineX + sigLineW / 2 - w / 2,
          y: sigLineY - 8,
          size: 10,
          font: sans,
          color: mutedText,
        });
      } else {
        page.drawText(titleText, {
          x: options.lineX,
          y: sigLineY - 8,
          size: 10,
          font: sans,
          color: mutedText,
        });
      }
    };

    // Single (authorized) signature, centered
    const sigCenterX = centerX;
    const sigLineX = sigCenterX - sigLineW / 2;
    const authorizedName = String(certificate.authorizedByName || 'Fateh Adhnouss').trim() || 'Fateh Adhnouss';
    const authorizedTitle = String(certificate.authorizedByTitle || 'Authorized Signature').trim() || 'Authorized Signature';
    const authorizedLabel = authorizedTitle.toLowerCase().includes(authorizedName.toLowerCase())
      ? authorizedTitle
      : `${authorizedTitle} – ${authorizedName}`;
    await drawSignature({
      name: authorizedName,
      title: authorizedLabel,
      lineX: sigLineX,
      nameCenterX: sigCenterX,
      titleAlign: 'center',
      image: authorizedSignatureImage || authorizedSignatureTextImage,
      imageMaxH: 50,
      imageYOffset: -8,
    });

    // QR
    try {
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 0, width: 256 });
      const qrBytes = dataUrlToBytes(qrDataUrl);
      const qr = await pdfDoc.embedPng(qrBytes);
      page.drawRectangle({
        x: qrBoxX,
        y: qrBoxY,
        width: qrBoxSize,
        height: qrBoxSize,
        color: rgb(1, 1, 1),
        borderColor: rgb(0.82, 0.84, 0.88),
        borderWidth: 1,
      });
      page.drawImage(qr, {
        x: qrBoxX + qrPad,
        y: qrBoxY + qrPad,
        width: qrSize,
        height: qrSize,
      });
    } catch {
      // ignore QR errors
    }

    return pdfDoc.save();
  }
}
