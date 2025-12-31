'use client';

export type TrimImageOptions = {
  /**
   * Downscale large images for the detection pass (faster).
   * Cropping is still performed at full resolution.
   */
  maxDetectDimension?: number;
  /** Alpha threshold (0-255) for considering a pixel "non-background". */
  alphaThreshold?: number;
  /**
   * Color threshold (0-765) for considering a pixel "non-background"
   * when the image is opaque (no transparency).
   */
  colorThreshold?: number;
  /** Extra padding (in pixels) around detected bounds (in original pixels). */
  paddingPx?: number;
};

const cache = new Map<string, Promise<string | null>>();

function cacheKey(src: string, options: Required<TrimImageOptions>) {
  return [
    src,
    options.maxDetectDimension,
    options.alphaThreshold,
    options.colorThreshold,
    options.paddingPx,
  ].join('|');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    // Allow canvas reads for same-origin assets; for cross-origin, CORS must be enabled.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function l1ColorDistance(r: number, g: number, b: number, br: number, bg: number, bb: number) {
  return Math.abs(r - br) + Math.abs(g - bg) + Math.abs(b - bb);
}

function luminance(r: number, g: number, b: number) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function chroma(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[idx] ?? 0;
}

function sampleBorderStats(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  alphaThreshold: number,
): { lumP10: number; lumP90: number; chromaP90: number } {
  const lums: number[] = [];
  const chromas: number[] = [];
  const step = Math.max(1, Math.floor(Math.min(w, h) / 40));

  const push = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    const a = data[i + 3];
    if (a <= alphaThreshold) return;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    lums.push(luminance(r, g, b));
    chromas.push(chroma(r, g, b));
  };

  for (let x = 0; x < w; x += step) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y += step) {
    push(0, y);
    push(w - 1, y);
  }

  return {
    lumP10: percentile(lums, 0.1),
    lumP90: percentile(lums, 0.9),
    chromaP90: percentile(chromas, 0.9),
  };
}

export async function trimImageToPngDataUrl(src: string, options?: TrimImageOptions): Promise<string | null> {
  if (!src) return null;
  if (typeof document === 'undefined') return null;

  const resolvedOptions: Required<TrimImageOptions> = {
    maxDetectDimension: options?.maxDetectDimension ?? 512,
    alphaThreshold: options?.alphaThreshold ?? 20,
    colorThreshold: options?.colorThreshold ?? 55,
    paddingPx: options?.paddingPx ?? 8,
  };

  const key = cacheKey(src, resolvedOptions);
  const existing = cache.get(key);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const img = await loadImage(src);
      const srcW = img.naturalWidth || img.width;
      const srcH = img.naturalHeight || img.height;
      if (!srcW || !srcH) return null;

      const detectScale = Math.min(1, resolvedOptions.maxDetectDimension / Math.max(srcW, srcH));
      const detectW = Math.max(1, Math.round(srcW * detectScale));
      const detectH = Math.max(1, Math.round(srcH * detectScale));

      const detectCanvas = document.createElement('canvas');
      detectCanvas.width = detectW;
      detectCanvas.height = detectH;
      const detectCtx = detectCanvas.getContext('2d', { willReadFrequently: true });
      if (!detectCtx) return null;
      detectCtx.clearRect(0, 0, detectW, detectH);
      detectCtx.drawImage(img, 0, 0, detectW, detectH);

      const imageData = detectCtx.getImageData(0, 0, detectW, detectH);
      const data = imageData.data;

      const corner = (x: number, y: number) => {
        const i = (y * detectW + x) * 4;
        return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
      };
      const corners = [
        corner(0, 0),
        corner(detectW - 1, 0),
        corner(0, detectH - 1),
        corner(detectW - 1, detectH - 1),
      ];

      const hasTransparentBg = corners.some((c) => c.a <= resolvedOptions.alphaThreshold);
      const borderStats = sampleBorderStats(data, detectW, detectH, resolvedOptions.alphaThreshold);
      const bgLumLow = borderStats.lumP10;
      const bgLumHigh = borderStats.lumP90;
      const bgChromaHigh = borderStats.chromaP90;
      const inkLumCutoff = Math.max(0, bgLumLow - 12);
      const inkChromaThreshold = Math.max(14, bgChromaHigh + 12);

      // Keep the old distance-based heuristic as a fallback, but only for clearly "non-neutral" pixels.
      const bg = (() => {
        if (hasTransparentBg) return { r: 0, g: 0, b: 0, a: 0 };
        const sum = corners.reduce(
          (acc, c) => ({ r: acc.r + c.r, g: acc.g + c.g, b: acc.b + c.b }),
          { r: 0, g: 0, b: 0 },
        );
        const n = corners.length;
        return { r: Math.round(sum.r / n), g: Math.round(sum.g / n), b: Math.round(sum.b / n), a: 255 };
      })();
      const effectiveColorThreshold = (() => {
        if (hasTransparentBg) return resolvedOptions.colorThreshold;
        const deviations = corners.map((c) => l1ColorDistance(c.r, c.g, c.b, bg.r, bg.g, bg.b));
        const maxDev = Math.max(...deviations, 0);
        return Math.max(resolvedOptions.colorThreshold, maxDev + 20);
      })();

      let minX = detectW;
      let minY = detectH;
      let maxX = -1;
      let maxY = -1;

      for (let y = 0; y < detectH; y += 1) {
        for (let x = 0; x < detectW; x += 1) {
          const i = (y * detectW + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (a <= resolvedOptions.alphaThreshold) continue;
          if (!hasTransparentBg) {
            const lum = luminance(r, g, b);
            const c = chroma(r, g, b);
            const isInkByTone = lum <= inkLumCutoff;
            const isInkByColor = c >= inkChromaThreshold;
            if (!isInkByTone && !isInkByColor) {
              // Fallback: if the pixel is clearly not "neutral" and also far from the sampled background, treat it as ink.
              // This helps with signatures that are close in luminance but distinct in hue.
              const isNeutralish = c <= 10 && lum >= bgLumLow - 6 && lum <= bgLumHigh + 6;
              if (isNeutralish) continue;
              const dist = l1ColorDistance(r, g, b, bg.r, bg.g, bg.b);
              if (dist <= effectiveColorThreshold) continue;
            }
          }

          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }

      if (maxX < 0 || maxY < 0) return null;

      // Convert bounds back to original pixels and add padding.
      const inv = 1 / detectScale;
      const pad = resolvedOptions.paddingPx;
      const cropX = Math.max(0, Math.floor(minX * inv - pad));
      const cropY = Math.max(0, Math.floor(minY * inv - pad));
      const cropW = Math.min(srcW - cropX, Math.ceil((maxX - minX + 1) * inv + pad * 2));
      const cropH = Math.min(srcH - cropY, Math.ceil((maxY - minY + 1) * inv + pad * 2));
      if (cropW <= 0 || cropH <= 0) return null;

      const outCanvas = document.createElement('canvas');
      outCanvas.width = cropW;
      outCanvas.height = cropH;
      const outCtx = outCanvas.getContext('2d');
      if (!outCtx) return null;
      outCtx.clearRect(0, 0, cropW, cropH);
      outCtx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      // If the source is opaque, remove background and keep only the "ink" pixels (helps signatures with scanned paper/gradients).
      if (!hasTransparentBg) {
        try {
          const outData = outCtx.getImageData(0, 0, cropW, cropH);
          const out = outData.data;
          const stats = sampleBorderStats(out, cropW, cropH, resolvedOptions.alphaThreshold);
          const outInkLumCutoff = Math.max(0, stats.lumP10 - 12);
          const outInkChromaThreshold = Math.max(14, stats.chromaP90 + 12);
          const lumSoftRange = 22;

          for (let i = 0; i < out.length; i += 4) {
            const a = out[i + 3];
            if (a <= resolvedOptions.alphaThreshold) {
              out[i + 3] = 0;
              continue;
            }
            const r = out[i];
            const g = out[i + 1];
            const b = out[i + 2];
            const lum = luminance(r, g, b);
            const c = chroma(r, g, b);

            const chromaStrength = outInkChromaThreshold > 0 ? c / outInkChromaThreshold : 0;
            const lumStrength = (outInkLumCutoff - lum) / lumSoftRange;
            const inkStrength = Math.max(chromaStrength, lumStrength, 0);
            const boostedStrength = Math.min(1, Math.max(0, inkStrength * 1.25));
            const newAlpha = boostedStrength * a;
            out[i + 3] = Math.round(newAlpha);
          }

          outCtx.putImageData(outData, 0, 0);
        } catch {
          // Best-effort only; keep the original crop if anything fails.
        }
      }

      return outCanvas.toDataURL('image/png');
    } catch {
      return null;
    }
  })();

  cache.set(key, promise);
  return promise;
}
