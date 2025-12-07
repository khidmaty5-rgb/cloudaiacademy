'use client';

import React, { useMemo, useEffect, type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';
import { connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const firebaseServices = useMemo(() => {
    // Initialize Firebase on the client side, once per component mount.
    return initializeFirebase();
  }, []); // Empty dependency array ensures this runs only once on mount

  // Avoid double-connecting to emulators during HMR
  const useEmulators = (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === '1' || process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true');
  useEffect(() => {
    if (!useEmulators) return;
    // Only connect if instances exist
    try {
      connectAuthEmulator(firebaseServices.auth, 'http://localhost:9099', { disableWarnings: true });
    } catch {}
    try {
      connectFirestoreEmulator(firebaseServices.firestore, 'localhost', 8080);
    } catch {}
    try {
      const functions = getFunctions(firebaseServices.firebaseApp);
      connectFunctionsEmulator(functions, 'localhost', 5001);
    } catch {}
  }, [firebaseServices, useEmulators]);

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
    >
      {children}
    </FirebaseProvider>
  );
}
