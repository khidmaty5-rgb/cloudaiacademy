// Server-only policy construction. No credentials or arbitrary URL schemes in CSP.
export function trustedOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return undefined;
    return url.origin;
  } catch { return undefined; }
}

export type SecurityResources = {
  authDomain?: string;
  analyticsUrl?: string;
  projectId?: string;
  storageOrigins?: string[];
};

export function contentSecurityPolicy(nonce: string, resources: SecurityResources, development = false): string {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(nonce)) throw new Error('Invalid CSP nonce');
  const auth = trustedOrigin(resources.authDomain ? `https://${resources.authDomain}` : undefined);
  const analytics = trustedOrigin(resources.analyticsUrl);
  const storage = (resources.storageOrigins || []).map(trustedOrigin).filter((v): v is string => !!v);
  const unique = (values: (string | undefined)[]) => [...new Set(values.filter(Boolean))].join(' ');
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ''}`,
    "script-src-attr 'none'",
    // React/Radix/Recharts use runtime style attributes and style-singleton tags.
    // This exception permits CSS only, never JavaScript or event handlers.
    "style-src 'self' 'unsafe-inline'",
    `img-src ${unique(["'self'", 'data:', 'blob:', 'https://placehold.co', 'https://images.unsplash.com', 'https://picsum.photos', ...storage])}`,
    "font-src 'self'",
    `connect-src ${unique(["'self'", 'https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com', 'https://firestore.googleapis.com', auth, ...storage, ...(development ? ['http://localhost:9099', 'http://localhost:8080', 'ws://localhost:*', 'ws://127.0.0.1:*'] : [])])}`,
    `frame-src ${unique(["'self'", 'data:', 'blob:', auth, analytics, 'https://stackblitz.com', 'https://excalidraw.com', 'https://labs.whizlabs.com', ...storage])}`,
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "worker-src 'self'",
    "media-src 'self' data: blob:",
    ...(development ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}

export const globalSecurityHeaders = [
  // Keep the rollout baseline in next.config's response-only headers. Middleware
  // response headers also enter Next's request, which would erase its full nonce
  // policy during Report-Only rendering. Enforced middleware overrides this.
  { key: 'Content-Security-Policy', value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'" },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Live teaching opens the provider in a separate tab. Keep clipboard-write
  // available to same-origin classroom controls; no camera/mic in Academy embeds.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), accelerometer=(), gyroscope=(), magnetometer=(), display-capture=(), clipboard-read=(), clipboard-write=(self "https://stackblitz.com" "https://excalidraw.com" "https://labs.whizlabs.com"), fullscreen=(self "https://stackblitz.com" "https://excalidraw.com" "https://labs.whizlabs.com")' },
];

// JSON is placed in HTML raw-text script context, not ordinary escaped JSX text.
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
