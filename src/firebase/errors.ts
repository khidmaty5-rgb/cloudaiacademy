'use client';
import { getAuth, type User } from 'firebase/auth';

type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: any;
};

interface FirebaseAuthToken {
  // Keep this structure minimal to avoid leaking PII in client-visible errors.
  sub: string;
  email_verified?: boolean;
  firebase?: {
    sign_in_provider?: string | null;
  };
}

interface FirebaseAuthObject {
  uid: string;
  token: FirebaseAuthToken;
}

interface SecurityRuleRequest {
  auth: FirebaseAuthObject | null;
  method: string;
  path: string;
  resource?: {
    data: any;
  };
}

/**
 * Builds a security-rule-compliant auth object from the Firebase User.
 * @param currentUser The currently authenticated Firebase user.
 * @returns An object that mirrors request.auth in security rules, or null.
 */
function buildAuthObject(currentUser: User | null): FirebaseAuthObject | null {
  if (!currentUser) {
    return null;
  }

  const token: FirebaseAuthToken = {
    sub: currentUser.uid,
    email_verified: currentUser.emailVerified,
    firebase: { sign_in_provider: currentUser.providerData[0]?.providerId || 'custom' },
  };

  return {
    uid: currentUser.uid,
    token: token,
  };
}

function summarizeResourceData(data: any) {
  if (!data || typeof data !== 'object') return undefined;
  try {
    const keys = Object.keys(data);
    return { __keys: keys.slice(0, 50) };
  } catch {
    return { __keys: [] as string[] };
  }
}

/**
 * Builds the complete, simulated request object for the error message.
 * It safely tries to get the current authenticated user.
 * @param context The context of the failed Firestore operation.
 * @returns A structured request object.
 */
function buildRequestObject(context: SecurityRuleContext): SecurityRuleRequest {
  let authObject: FirebaseAuthObject | null = null;
  try {
    // Safely attempt to get the current user.
    const firebaseAuth = getAuth();
    const currentUser = firebaseAuth.currentUser;
    if (currentUser) {
      authObject = buildAuthObject(currentUser);
    }
  } catch {
    // This will catch errors if the Firebase app is not yet initialized.
    // In this case, we'll proceed without auth information.
  }

  return {
    auth: authObject,
    method: context.operation,
    path: `/databases/(default)/documents/${context.path}`,
    resource: context.requestResourceData ? { data: summarizeResourceData(context.requestResourceData) } : undefined,
  };
}

/**
 * Builds a safe, user-facing error message for permission failures.
 */
function buildPublicErrorMessage(): string {
  return 'Missing or insufficient permissions.';
}

/**
 * A custom error class designed to be consumed by an LLM for debugging.
 * It structures the error information to mimic the request object
 * available in Firestore Security Rules.
 */
export class FirestorePermissionError extends Error {
  public readonly request: SecurityRuleRequest;

  constructor(context: SecurityRuleContext) {
    const requestObject = buildRequestObject(context);
    super(buildPublicErrorMessage());
    this.name = 'FirebaseError';
    this.request = requestObject;
  }
}
