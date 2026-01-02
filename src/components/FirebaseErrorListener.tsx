'use client';

import { useState, useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * An invisible component that listens for globally emitted 'permission-error' events.
 * It throws any received error to be caught by Next.js's global-error.tsx.
 */
export function FirebaseErrorListener() {
  // Use the specific error type for the state for type safety.
  const [error, setError] = useState<FirestorePermissionError | null>(null);

  useEffect(() => {
    // The callback now expects a strongly-typed error, matching the event payload.
    const handleError = (error: FirestorePermissionError) => {
      // Set error in state to trigger a re-render.
      setError(error);
    };

    // The typed emitter will enforce that the callback for 'permission-error'
    // matches the expected payload type (FirestorePermissionError).
    errorEmitter.on('permission-error', handleError);

    // Unsubscribe on unmount to prevent memory leaks.
    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  // In development, log once and clear to avoid noisy re-renders (React Strict Mode can double-log).
  useEffect(() => {
    if (!error) return;
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[FirestorePermissionWarning]', {
        message: error.message,
        request: error.request,
      });
      setError(null);
    }
  }, [error]);

  // In production, treat permission errors as fatal (caught by global-error.tsx).
  if (error && process.env.NODE_ENV === 'production') {
    throw error;
  }

  // This component renders nothing.
  return null;
}
