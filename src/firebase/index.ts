'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  if (!getApps().length) {
    let firebaseApp;
    const hasEnvConfig = !!firebaseConfig.apiKey;

    if (hasEnvConfig) {
      firebaseApp = initializeApp(firebaseConfig);
    } else {
      try {
        // Attempt to initialize via Firebase App Hosting environment variables
        firebaseApp = initializeApp();
      } catch (e) {
        if (process.env.NODE_ENV === "production") {
          console.warn('Automatic initialization failed. Falling back to firebase config object.', e);
        }
        firebaseApp = initializeApp(firebaseConfig);
      }
    }

    return getSdks(firebaseApp);
  }

  // If already initialized, return the SDKs with the already initialized App
  return getSdks(getApp());
}

function initFirestore(firebaseApp: FirebaseApp) {
  try {
    // Improves reliability on networks/proxies that block Firestore streaming.
    // Default to long-polling in dev; allow explicit override via env.
    const forceLongPolling =
      process.env.NEXT_PUBLIC_FIRESTORE_FORCE_LONG_POLLING === '1' ||
      process.env.NEXT_PUBLIC_FIRESTORE_FORCE_LONG_POLLING === 'true' ||
      process.env.NODE_ENV !== 'production';

    return initializeFirestore(
      firebaseApp,
      forceLongPolling
        ? { experimentalForceLongPolling: true }
        : { experimentalAutoDetectLongPolling: true },
    );
  } catch {
    return getFirestore(firebaseApp);
  }
}

export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: initFirestore(firebaseApp),
    storage: getStorage(firebaseApp)
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
