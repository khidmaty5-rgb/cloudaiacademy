export function isPriceFree(price: unknown) {
  if (typeof price === 'number' && Number.isFinite(price)) return price <= 0;
  if (typeof price !== 'string') return false;

  const raw = price.trim();
  if (!raw) return false;

  const lowered = raw.toLowerCase();
  if (lowered === 'free' || lowered === '$0' || lowered === '0' || lowered === '0.00') return true;

  const cleaned = lowered.replace(/[^0-9.-]/g, '').trim();
  if (!cleaned) return false;

  const n = Number(cleaned);
  return Number.isFinite(n) && n <= 0;
}

