'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener'
import { ensureUserClaimsSync } from '@/firebase/claim-sync';
import { errorEmitter } from '@/firebase/error-emitter';
import { shouldAutoCreateStudentProfile } from '@/lib/roles';

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}

// Internal state for user authentication
interface UserAuthState {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// Combined state for the Firebase context
export interface FirebaseContextState {
  areServicesAvailable: boolean; // True if core services (app, firestore, auth instance) are provided
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null; // The Auth service instance
  // User authentication state
  user: User | null;
  isUserLoading: boolean; // True during initial auth check
  userError: Error | null; // Error from auth listener
}

// Return type for useFirebase()
export interface FirebaseServicesAndUser {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// Return type for useUser() - specific to user auth state
export interface UserHookResult { // Renamed from UserAuthHookResult for consistency if desired, or keep as UserAuthHookResult
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// React Context
export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

/**
 * FirebaseProvider manages and provides Firebase services and user authentication state.
 */
export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
}) => {
  const [userAuthState, setUserAuthState] = useState<UserAuthState>({
    user: null,
    isUserLoading: true, // Start loading until first auth event
    userError: null,
  });

  // Effect to subscribe to Firebase auth state changes
  useEffect(() => {
    if (!auth) { // If no Auth service instance, cannot determine user state
      setUserAuthState({ user: null, isUserLoading: false, userError: new Error("Auth service not provided.") });
      return;
    }

    setUserAuthState({ user: null, isUserLoading: true, userError: null }); // Reset on auth instance change

    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => { // Auth state determined
        setUserAuthState({ user: firebaseUser, isUserLoading: false, userError: null });
      },
      (error) => { // Auth listener error
        console.error("FirebaseProvider: onAuthStateChanged error:", error);
        setUserAuthState({ user: null, isUserLoading: false, userError: error });
      }
    );
    return () => unsubscribe(); // Cleanup
  }, [auth]); // Depends on the auth instance

  useEffect(() => {
    async function ensureClaims() {
      if (!auth || !firestore) return;
      const u = userAuthState.user;
      if (!u) return;
      try {
        await ensureUserClaimsSync(auth, firestore, u);
      } catch (e) {
        console.error('[FirebaseProvider.ensureClaims] Claim sync failed', e);
        try { errorEmitter.emit('claim-error', (e as Error) || new Error('Claim sync failed')); } catch {}
      }
    }
    ensureClaims();
  }, [auth, firestore, userAuthState.user]);

  // Ensure student accounts always have a profile doc (OAuth logins, deleted docs, etc.).
  useEffect(() => {
    async function ensureUserProfileDoc() {
      if (!auth || !firestore) return;
      const u = userAuthState.user;
      if (!u) return;

      // Never auto-create staff profiles.
      let claimRole: string | undefined;
      try {
        const tr = await u.getIdTokenResult();
        claimRole = (tr.claims as any)?.role as string | undefined;
      } catch {}
      if (!shouldAutoCreateStudentProfile(claimRole)) return;

      const ref = doc(firestore, 'users', u.uid);
      try {
        const snap = await getDoc(ref);
        if (snap.exists()) return;
      } catch (e) {
        console.warn('[FirebaseProvider.ensureUserProfileDoc] Read failed', e);
        return;
      }

      const displayName = (u.displayName || '').trim();
      const parts = displayName.split(/\s+/).filter(Boolean);
      const firstName = parts[0] || 'Student';
      const lastName = parts.slice(1).join(' ');

      try {
        await setDoc(
          ref,
          {
            id: u.uid,
            firstName,
            lastName,
            email: u.email || null,
            dateJoined: serverTimestamp(),
            role: 'student',
          },
          { merge: true },
        );
      } catch (e) {
        console.warn('[FirebaseProvider.ensureUserProfileDoc] Create failed', e);
      }
    }
    ensureUserProfileDoc();
  }, [auth, firestore, userAuthState.user]);

  // React to role changes in the user's Firestore document and re-sync custom claims immediately
  useEffect(() => {
    if (!auth || !firestore) return;
    const u = userAuthState.user;
    if (!u) return;

    const ref = doc(firestore, 'users', u.uid);
    const unsubscribe = onSnapshot(ref, async (snap) => {
      if (!snap.exists()) return;
      try {
        await ensureUserClaimsSync(auth, firestore, u);
      } catch (e) {
        console.error('[FirebaseProvider.role-listener] Claim sync failed after role update', e);
        try { errorEmitter.emit('claim-error', (e as Error) || new Error('Claim sync failed')); } catch {}
      }
    });
    return () => {
      try {
        unsubscribe();
      } catch (e) {
        console.warn('[FirestoreUnsubscribeError]', e);
      }
    };
  }, [auth, firestore, userAuthState.user]);

  // Memoize the context value
  const contextValue = useMemo((): FirebaseContextState => {
    const servicesAvailable = !!(firebaseApp && firestore && auth);
    return {
      areServicesAvailable: servicesAvailable,
      firebaseApp: servicesAvailable ? firebaseApp : null,
      firestore: servicesAvailable ? firestore : null,
      auth: servicesAvailable ? auth : null,
      user: userAuthState.user,
      isUserLoading: userAuthState.isUserLoading,
      userError: userAuthState.userError,
    };
  }, [firebaseApp, firestore, auth, userAuthState]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};

/**
 * Hook to access core Firebase services and user authentication state.
 * Throws error if core services are not available or used outside provider.
 */
export const useFirebase = (): FirebaseServicesAndUser => {
  const context = useContext(FirebaseContext);

  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider.');
  }

  if (!context.areServicesAvailable || !context.firebaseApp || !context.firestore || !context.auth) {
    throw new Error('Firebase core services not available. Check FirebaseProvider props.');
  }

  return {
    firebaseApp: context.firebaseApp,
    firestore: context.firestore,
    auth: context.auth,
    user: context.user,
    isUserLoading: context.isUserLoading,
    userError: context.userError,
  };
};

/** Hook to access Firebase Auth instance. */
export const useAuth = (): Auth => {
  const { auth } = useFirebase();
  return auth;
};

/** Hook to access Firestore instance. */
export const useFirestore = (): Firestore => {
  const { firestore } = useFirebase();
  return firestore;
};

/** Hook to access Firebase App instance. */
export const useFirebaseApp = (): FirebaseApp => {
  const { firebaseApp } = useFirebase();
  return firebaseApp;
};

type MemoFirebase <T> = T & {__memo?: boolean};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T | (MemoFirebase<T>) {
  const memoized = useMemo(() => factory(), deps);
  
  if(typeof memoized !== 'object' || memoized === null) return memoized;
  (memoized as MemoFirebase<T>).__memo = true;
  
  return memoized;
}

/**
 * Hook specifically for accessing the authenticated user's state.
 * This provides the User object, loading status, and any auth errors.
 * @returns {UserHookResult} Object with user, isUserLoading, userError.
 */
export const useUser = (): UserHookResult => { // Renamed from useAuthUser
  const { user, isUserLoading, userError } = useFirebase(); // Leverages the main hook
  return { user, isUserLoading, userError };
};
