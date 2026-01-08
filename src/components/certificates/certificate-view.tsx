'use client';

import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
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

export type CertificateViewProps = {
  certificate: Certificate;
  verifyUrl: string;
};

function SignatureMark(props: {
  sources: string[];
  fallbackText: string;
  imgClassName?: string;
  textClassName?: string;
  trim?: boolean;
  alt?: string;
}) {
  const { sources, fallbackText, imgClassName, textClassName, trim = true, alt = 'Signature' } = props;
  const [idx, setIdx] = useState(0);
  const src = sources[idx];
  const [trimmedSrc, setTrimmedSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTrimmedSrc(null);
    if (!src || !trim) return () => {};

    // Only trim signature-like images; keep behavior predictable for other assets.
    const shouldTrim = src.toLowerCase().includes('/signature');
    if (!shouldTrim) return () => {};

    (async () => {
      const out = await trimImageToPngDataUrl(src);
      if (cancelled) return;
      if (out) setTrimmedSrc(out);
    })();

    return () => {
      cancelled = true;
    };
  }, [src, trim]);

  if (!src) {
    return <p className={textClassName}>{fallbackText}</p>;
  }

  return (
    <img
      src={trimmedSrc || src}
      alt={alt}
      className={imgClassName}
      onError={() => {
        setTrimmedSrc(null);
        setIdx((i) => i + 1);
      }}
      loading="lazy"
    />
  );
}

export default function CertificateView({ certificate, verifyUrl }: CertificateViewProps) {
  const completedAt = toDateValue(certificate.completedAt);
  const completedLabel = completedAt ? format(completedAt, 'MMMM yyyy') : '-';
  const authorizedName = (certificate.authorizedByName || 'Fateh Adhnouss').trim() || 'Fateh Adhnouss';
  const authorizedTitle = (certificate.authorizedByTitle || 'Authorized Signature').trim() || 'Authorized Signature';
  const authorizedLabel = authorizedTitle.toLowerCase().includes(authorizedName.toLowerCase())
    ? authorizedTitle
    : `${authorizedTitle} – ${authorizedName}`;
  const recipientNameStyle = (certificate as any)?.recipientNameStyle as string | undefined;
  const isRevoked = certificate.status === 'REVOKED';

  const recipientNameScriptFontFamily = (() => {
    switch (recipientNameStyle) {
      case 'GABRIOLA':
        return '"Gabriola","Monotype Corsiva","Segoe Script","Lucida Handwriting","Apple Chancery",cursive';
      case 'EDWARDIAN':
        return '"Edwardian Script ITC","Kunstler Script","French Script MT","Segoe Script","Apple Chancery",cursive';
      case 'FRENCH_SCRIPT':
        return '"French Script MT","Kunstler Script","Edwardian Script ITC","Segoe Script","Apple Chancery",cursive';
      case 'CALLIGRAPHY':
      default:
        return '"Monotype Corsiva","Edwardian Script ITC","Segoe Script","Brush Script MT","Lucida Handwriting","Apple Chancery",cursive';
    }
  })();

  const recipientNameClassName =
    recipientNameStyle === 'SERIF'
      ? 'font-serif text-4xl font-bold leading-none text-primary md:text-5xl'
      : recipientNameStyle === 'SANS'
        ? 'font-headline text-4xl font-bold leading-none text-primary md:text-5xl'
        : 'text-5xl leading-none text-primary md:text-6xl';

  return (
    <div className="w-full rounded-2xl border-4 border-primary/90 bg-gradient-to-br from-background to-muted/40 p-4 shadow-sm md:p-6">
      <div className="relative overflow-hidden rounded-xl border-2 border-accent/60 p-6 md:p-10">
        <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
          <img
            src="/images/certificateLog.png"
            alt=""
            aria-hidden="true"
            className="w-[520px] max-w-[90%] rotate-[-12deg] opacity-[0.06] object-contain"
          />
        </div>

        <div className="relative z-10 flex flex-col items-center text-center">
          <img
            src="/images/certificateLog.png"
            alt="CloudAI Academy"
            className="h-20 w-auto object-contain"
            loading="lazy"
          />
          <p className="mt-2 text-xs tracking-[0.35em] text-muted-foreground">CLOUDAI ACADEMY</p>

          <h1 className="mt-6 font-headline text-4xl font-extrabold tracking-wide text-primary md:text-6xl">
            CERTIFICATE OF COMPLETION
          </h1>
          <p className="mt-4 text-lg text-muted-foreground md:text-xl">
            This certificate is proudly presented to
          </p>

          <div className="mt-6 w-full px-6 py-6">
            <p
              className={recipientNameClassName}
              style={recipientNameStyle === 'SERIF' || recipientNameStyle === 'SANS' ? undefined : { fontFamily: recipientNameScriptFontFamily }}
            >
              {certificate.userName}
            </p>
          </div>

          <p className="mt-6 text-lg text-muted-foreground md:text-xl">
            for successfully completing the course:
          </p>

          <div className="mt-4 w-full px-4 py-3">
            <p className="font-headline text-2xl font-semibold text-primary md:text-3xl">
              {certificate.courseTitle}
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground md:text-base">
          <span>
            <span className="font-medium text-foreground">Completion date:</span> {completedLabel}
          </span>
          <span className="hidden md:inline">|</span>
          <span>
            <span className="font-medium text-foreground">Total hours:</span> {certificate.totalHours}
          </span>
          <span className="hidden md:inline">|</span>
          <span>
            <span className="font-medium text-foreground">Certificate ID:</span>{' '}
            <span className="font-semibold text-primary">{certificate.id}</span>
          </span>
        </div>

        <div className="mt-6 text-center">
          <p className="text-lg font-semibold text-primary">Issued by {certificate.issuedBy}</p>
          <div className="mt-3 h-px w-full bg-border" />
          <p className="mt-3 break-all text-sm text-muted-foreground md:text-base">
            {verifyUrl}
          </p>
        </div>

        <div className="mt-10 grid gap-8 md:grid-cols-3 md:items-end">
          <div className="flex items-center justify-start">
            <div
              className={[
                'grid h-20 w-20 place-items-center rounded-full border-4',
                isRevoked ? 'border-destructive/70 bg-destructive/10' : 'border-accent/70 bg-accent/10',
              ].join(' ')}
            >
              {isRevoked ? (
                <span className="text-xs font-bold text-destructive">REVOKED</span>
              ) : (
                <SignatureMark
                  sources={['/images/stamp.png', '/images/verified-stamp.png']}
                  fallbackText="VERIFIED"
                  imgClassName="h-16 w-16 object-contain"
                  textClassName="text-xs font-bold text-accent"
                  trim={false}
                  alt="Verified stamp"
                />
              )}
            </div>
          </div>

          <div className="flex items-end justify-center">
            <div className="text-center">
              <SignatureMark
                sources={['/images/signature_2.png', '/images/signature.png', '/images/signature2.png']}
                fallbackText={authorizedName}
                imgClassName="mx-auto h-8 w-auto max-w-[320px] translate-y-2 object-contain object-bottom"
                textClassName="font-signature text-3xl leading-none text-primary"
                alt="Authorized signature"
              />
              <div className="mx-auto mt-1 h-px w-56 bg-border" />
              <p className="mt-2 text-sm text-muted-foreground">{authorizedLabel}</p>
            </div>
          </div>

          <div className="flex items-end justify-center md:justify-end">
            <div className="grid h-24 w-24 place-items-center rounded-xl border border-border bg-white p-2">
              {verifyUrl ? (
                <QRCode
                  value={verifyUrl}
                  size={80}
                  style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                  viewBox="0 0 256 256"
                  title="Verify certificate"
                />
              ) : (
                <span className="text-xs text-muted-foreground">QR / Verify</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
