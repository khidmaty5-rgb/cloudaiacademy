'use client';

import { useState, useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * An invisible component that listens for globally emitted 'permission-error' events.
 * Permission denials are recoverable UI errors, not application crashes.
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

  if (!error) return null;
  const ar = typeof document !== 'undefined' && document.documentElement.lang === 'ar';
  return (
    <div role="alert" className="fixed bottom-4 inset-x-4 z-50 mx-auto max-w-lg rounded-xl border border-destructive bg-background p-4 shadow-lg">
      <p>{ar ? 'تعذّر الوصول إلى بعض البيانات. تحقق من صلاحيات حسابك أو سجّل الدخول مجددًا.' : 'Some data could not be accessed. Check your account permissions or sign in again.'}</p>
      <button type="button" className="mt-2 underline" onClick={() => setError(null)}>
        {ar ? 'إغلاق' : 'Dismiss'}
      </button>
    </div>
  );
}
