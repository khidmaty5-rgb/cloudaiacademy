'use client';
    
import { useState, useEffect } from 'react';
import {
  DocumentReference,
  onSnapshot,
  DocumentData,
  FirestoreError,
  DocumentSnapshot,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/** Utility type to add an 'id' field to a given type T. */
type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useDoc hook.
 * @template T Type of the document data.
 */
export interface UseDocResult<T> {
  data: WithId<T> | null; // Document data with ID, or null.
  isLoading: boolean;       // True if loading.
  error: FirestoreError | Error | null; // Error object, or null.
}

/**
 * React hook to subscribe to a single Firestore document in real-time.
 * Handles nullable references.
 * 
 * IMPORTANT! YOU MUST MEMOIZE the inputted memoizedTargetRefOrQuery or BAD THINGS WILL HAPPEN
 * use useMemo to memoize it per React guidence.  Also make sure that it's dependencies are stable
 * references
 *
 *
 * @template T Optional type for document data. Defaults to any.
 * @param {DocumentReference<DocumentData> | null | undefined} docRef -
 * The Firestore DocumentReference. Waits if null/undefined.
 * @returns {UseDocResult<T>} Object with data, isLoading, error.
 */
export function useDoc<T = any>(
  memoizedDocRef: DocumentReference<DocumentData> | null | undefined,
): UseDocResult<T> {
  type StateDataType = WithId<T> | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    if (!memoizedDocRef) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    // Optional: setData(null); // Clear previous data instantly
    let cancelled = false;
    let didUnsubscribe = false;
    const TIMEOUT_MS = 8000;
    let didSettle = false;
    let didResolveWithData = false;

    const timeoutId = setTimeout(() => {
      if (!didSettle && !cancelled) {
        setIsLoading(false);
        setError(new Error('Timed out connecting to Firestore.'));
      }
    }, TIMEOUT_MS);

    const handleError = (err: FirestoreError) => {
      if (cancelled) return;
      if (err.code === 'permission-denied' || err.code === 'unauthenticated') {
        const contextualError = new FirestorePermissionError({
          operation: 'get',
          path: memoizedDocRef.path,
        });
        setError(contextualError);
        setData(null);
        setIsLoading(false);
        didSettle = true;
        // trigger global error propagation
        errorEmitter.emit('permission-error', contextualError);
      } else {
        // If we already have a known-good result (from a snapshot or fallback fetch),
        // keep it and don't replace it with a late-arriving subscription error.
        if (didResolveWithData) {
          console.warn('[FirestoreDocSubscriptionError]', err);
          setIsLoading(false);
          return;
        }
        setError(err);
        setIsLoading(false);
        didSettle = true;
      }
    };

    const safeUnsubscribe = (unsubscribe: () => void) => {
      if (didUnsubscribe) return;
      didUnsubscribe = true;
      try {
        unsubscribe();
      } catch (e) {
        console.warn('[FirestoreUnsubscribeError]', e);
      }
    };

    const unsubscribe = onSnapshot(
      memoizedDocRef,
      (snapshot: DocumentSnapshot<DocumentData>) => {
        if (cancelled) return;
        if (snapshot.exists()) {
          setData({ ...(snapshot.data() as T), id: snapshot.id });
        } else {
          // Document does not exist
          setData(null);
        }
        setError(null); // Clear any previous error on successful snapshot (even if doc doesn't exist)
        setIsLoading(false);
        didSettle = true;
        didResolveWithData = true;
        clearTimeout(timeoutId);
      },
      (error: FirestoreError) => {
        if (cancelled) return;
        // Permission errors should still block and propagate globally.
        if (error.code === 'permission-denied' || error.code === 'unauthenticated') {
          clearTimeout(timeoutId);
          handleError(error);
          return;
        }

        // If we already have usable data, don't blow up the page due to a late subscription error.
        if (didResolveWithData) {
          console.warn('[FirestoreDocSubscriptionError]', error);
          setIsLoading(false);
          return;
        }

        // Otherwise surface the subscription error.
        didSettle = true;
        clearTimeout(timeoutId);
        handleError(error);
      }
    );

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      safeUnsubscribe(unsubscribe);
    };
  }, [memoizedDocRef]); // Re-run if the memoizedDocRef changes.

  return { data, isLoading, error };
}
