import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

// This Cloud Function is triggered when a user's document in Firestore is created.
// Its purpose is to set a custom claim (`role`) on the user's authentication token.
// This allows Firestore Security Rules to perform role-based access control efficiently
// by reading the role directly from the request.auth.token object, which is much
// faster and more scalable than reading from the Firestore document.
export const onUserCreate = functions.firestore
  .document("users/{userId}")
  .onCreate(async (snap, context) => {
    const userRecord = snap.data();
    const userId = context.params.userId;

    if (!userRecord || !userId) {
      console.error("User data or user ID is missing.");
      return;
    }

    // Get the role from the newly created user document.
    const role = userRecord.role;

    // If a role is defined, set it as a custom claim on the user's auth token.
    if (role) {
      try {
        await admin.auth().setCustomUserClaims(userId, { role });
        console.log(`Custom claim 'role: ${role}' set for user ${userId}`);
      } catch (error) {
        console.error(
          `Failed to set custom claim for user ${userId}:`,
          error
        );
      }
    }
  });

// Admin-only callable to create a user without affecting the caller's session
export const adminCreateUser = functions.https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Admin privileges required.');
  }

  const email: string = (data && data.email) || '';
  const password: string = (data && data.password) || '';
  const fullName: string = (data && data.fullName) || '';
  const userRole: 'student' | 'teacher' | 'admin' = (data && data.role) || 'student';

  if (!email || !password || !fullName) {
    throw new functions.https.HttpsError('invalid-argument', 'email, password, and fullName are required.');
  }

  try {
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: fullName,
    });

    // Set custom role claim
    await admin.auth().setCustomUserClaims(userRecord.uid, { role: userRole });

    // Parse name
    const parts = fullName.trim().split(' ');
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ');

    // Create Firestore profile document
    await admin.firestore().doc(`users/${userRecord.uid}`).set({
      id: userRecord.uid,
      firstName,
      lastName,
      email: userRecord.email,
      dateJoined: admin.firestore.FieldValue.serverTimestamp(),
      role: userRole,
    });

    return { uid: userRecord.uid };
  } catch (err: any) {
    console.error('adminCreateUser failed:', err);
    throw new functions.https.HttpsError('internal', err?.message || 'Failed to create user');
  }
});

// This Cloud Function is triggered when a user's document in Firestore is updated.
// It checks if the 'role' field has changed. If it has, it updates the custom
// claim on the user's authentication token to reflect the new role. This ensures
// that the security rules always have the most up-to-date role information.
export const onUserUpdate = functions.firestore
  .document("users/{userId}")
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const userId = context.params.userId;

    if (!beforeData || !afterData || !userId) {
      console.error("User data or user ID is missing for update.");
      return;
    }

    const newRole = afterData.role;
    const oldRole = beforeData.role;

    // Only update claims if the role has actually changed to avoid unnecessary operations.
    if (newRole && newRole !== oldRole) {
      try {
        await admin.auth().setCustomUserClaims(userId, { role: newRole });
        console.log(
          `Custom claim 'role' updated to '${newRole}' for user ${userId}`
        );
      } catch (error) {
        console.error(
          `Failed to update custom claim for user ${userId}:`,
          error
        );
      }
    }
  });
