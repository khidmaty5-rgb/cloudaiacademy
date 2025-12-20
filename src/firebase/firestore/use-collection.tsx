'use client';

import { useState, useEffect } from 'react';
import {
  Query,
  onSnapshot,
  getDocs,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/** Utility type to add an 'id' field to a given type T. */
export type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useCollection hook.
 * @template T Type of the document data.
 */
export interface UseCollectionResult<T> {
  data: WithId<T>[] | null; // Document data with ID, or null.
  isLoading: boolean;       // True if loading.
  error: FirestoreError | Error | null; // Error object, or null.
}

/* Internal implementation of Query:
  https://github.com/firebase/firebase-js-sdk/blob/c5f08a9bc5da0d2b0207802c972d53724ccef055/packages/firestore/src/lite-api/reference.ts#L143
*/
export interface InternalQuery extends Query<DocumentData> {
  _query: {
    path: {
      canonicalString(): string;
      toString(): string;
    }
  }
}

/**
 * React hook to subscribe to a Firestore collection or query in real-time.
 * Handles nullable references/queries.
 * 
 *
 * IMPORTANT! YOU MUST MEMOIZE the inputted memoizedTargetRefOrQuery or BAD THINGS WILL HAPPEN
 * use useMemo to memoize it per React guidence.  Also make sure that it's dependencies are stable
 * references
 *  
 * @template T Optional type for document data. Defaults to any.
 * @param {CollectionReference<DocumentData> | Query<DocumentData> | null | undefined} targetRefOrQuery -
 * The Firestore CollectionReference or Query. Waits if null/undefined.
 * @returns {UseCollectionResult<T>} Object with data, isLoading, error.
 */
export function useCollection<T = any>(
    memoizedTargetRefOrQuery: ((CollectionReference<DocumentData> | Query<DocumentData>) & {__memo?: boolean})  | null | undefined,
): UseCollectionResult<T> {
  type ResultItemType = WithId<T>;
  type StateDataType = ResultItemType[] | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    if (!memoizedTargetRefOrQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    let cancelled = false;
    const TIMEOUT_MS = 8000;
    let didSettle = false;
    const timeoutId = setTimeout(() => {
      if (!didSettle && !cancelled) {
        setIsLoading(false);
        setError(new Error('Timed out connecting to Firestore.'));
      }
    }, TIMEOUT_MS);

    const path: string =
      memoizedTargetRefOrQuery.type === 'collection'
        ? (memoizedTargetRefOrQuery as CollectionReference).path
        : (memoizedTargetRefOrQuery as unknown as InternalQuery)._query.path.canonicalString();

    const handleError = (err: FirestoreError) => {
      // Only treat real permission failures as "permission errors".
      if (err.code === 'permission-denied' || err.code === 'unauthenticated') {
        const contextualError = new FirestorePermissionError({
          operation: 'list',
          path,
        });
        setError(contextualError);
        setData(null);
        setIsLoading(false);
        // trigger global error propagation
        errorEmitter.emit('permission-error', contextualError);
      } else {
        setError(err);
        setIsLoading(false);
      }
    };

    // One-shot fetch to avoid hanging when Firestore streaming is blocked.
    // This also makes list pages usable even if realtime listeners can’t connect.
    getDocs(memoizedTargetRefOrQuery)
      .then((snapshot) => {
        if (cancelled) return;
        const results: ResultItemType[] = [];
        for (const doc of snapshot.docs) {
          results.push({ ...(doc.data() as T), id: doc.id });
        }
        setData(results);
        setError(null);
        setIsLoading(false);
        didSettle = true;
        clearTimeout(timeoutId);
      })
      .catch((err: FirestoreError) => {
        if (cancelled) return;
        didSettle = true;
        clearTimeout(timeoutId);
        handleError(err);
      });

    // Directly use memoizedTargetRefOrQuery as it's assumed to be the final query
    const unsubscribe = onSnapshot(
      memoizedTargetRefOrQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const results: ResultItemType[] = [];
        for (const doc of snapshot.docs) {
          results.push({ ...(doc.data() as T), id: doc.id });
        }
        setData(results);
        setError(null);
        setIsLoading(false);
        didSettle = true;
        clearTimeout(timeoutId);
      },
      (error: FirestoreError) => {
        didSettle = true;
        clearTimeout(timeoutId);
        handleError(error);
      }
    );

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [memoizedTargetRefOrQuery]); // Re-run if the target query/reference changes.
  if(memoizedTargetRefOrQuery && !memoizedTargetRefOrQuery.__memo) {
    throw new Error(memoizedTargetRefOrQuery + ' was not properly memoized using useMemoFirebase');
  }
  return { data, isLoading, error };
}
