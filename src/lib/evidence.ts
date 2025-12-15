export const EVIDENCE_BASE_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_EVIDENCE_BASE_URL) ||
  'https://analytics.cloudaiacademy.ca';

export function getEvidenceUrl(path: string): string {
  const base = EVIDENCE_BASE_URL.replace(/\/$/, '');
  const p = path.replace(/^\//, '');
  return `${base}/${p}`;
}
