import admin from 'firebase-admin';

function init() {
  if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || undefined;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL || undefined;
    const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY || '';
    const privateKey = rawKey ? rawKey.replace(/\\n/g, '\n') : undefined;
    if (projectId && clientEmail && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey })
      });
    } else {
      admin.initializeApp();
    }
  }
}

export function getAdminAuth() {
  init();
  return admin.auth();
}
