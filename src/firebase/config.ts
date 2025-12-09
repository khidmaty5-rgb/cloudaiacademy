const isProd = process.env.NODE_ENV === 'production';

// IMPORTANT: Use direct access so Next.js inlines values at build time on the client.
const env = {
  apiKey: (process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '').trim(),
  authDomain: (process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '').trim(),
  projectId: (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '').trim(),
  appId: (process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '').trim(),
  messagingSenderId: (process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '').trim(),
  measurementId: (process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '').trim() || undefined,
} as const;

export const firebaseConfig = {
  apiKey: env.apiKey,
  authDomain: env.authDomain,
  projectId: env.projectId,
  appId: env.appId,
  messagingSenderId: env.messagingSenderId,
  measurementId: env.measurementId,
};

if (!isProd) {
  const missing = Object.entries({
    NEXT_PUBLIC_FIREBASE_API_KEY: env.apiKey,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: env.authDomain,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: env.projectId,
    NEXT_PUBLIC_FIREBASE_APP_ID: env.appId,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: env.messagingSenderId,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    // eslint-disable-next-line no-console
    console.warn('[Firebase] Missing env vars:', missing.join(', '), 'Add them to .env.local');
  }
  const mask = (v?: string) => (v ? `${v.slice(0, 4)}…${v.slice(-4)}` : v);
  // eslint-disable-next-line no-console
  console.log('[Firebase] Using', {
    projectId: env.projectId,
    apiKey: mask(env.apiKey),
    appId: env.appId ? `${env.appId.slice(0, 6)}…${env.appId.slice(-6)}` : undefined,
  });
}
