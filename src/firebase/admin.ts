import 'server-only';

import { getFirebaseAdminAuth } from '@/server/firebase-admin';

export function getAdminAuth() {
  return getFirebaseAdminAuth();
}
