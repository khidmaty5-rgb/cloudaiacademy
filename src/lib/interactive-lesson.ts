// Never place these documents in the parent DOM or serve them as Academy HTML.
export const INTERACTIVE_HTML_LIMIT = 650_000;
export const INTERACTIVE_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' data:; img-src data:; font-src data:; media-src data:; connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
export function interactiveDocument(html: string): string {
  if (!html.trim() || new TextEncoder().encode(html).length > INTERACTIVE_HTML_LIMIT) throw new Error('CONTENT_TOO_LARGE');
  // This policy appears before ALL uploaded markup, including scripts/metas.
  // Additional policies in the package can only tighten the restrictions.
  return '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="' + INTERACTIVE_CSP + '"><meta name="referrer" content="no-referrer">' + html;
}
export function interactiveUrl(html: string): string {
  // data: documents have an opaque origin even before iframe sandboxing.
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(interactiveDocument(html));
}
