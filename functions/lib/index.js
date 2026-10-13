"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onUserUpdate = exports.adminCreateUser = exports.onUserCreate = exports.onRoleChangeAuditCreate = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const user_roles_1 = require("./user-roles");
admin.initializeApp();
async function synchronizeProfileRole(userId) {
    var _a;
    const current = await admin.firestore().doc(`users/${userId}`).get();
    const role = current.exists ? (_a = current.data()) === null || _a === void 0 ? void 0 : _a.role : undefined;
    if (!(0, user_roles_1.isUserRole)(role))
        return false;
    const account = await admin.auth().getUser(userId);
    await admin.auth().setCustomUserClaims(userId, Object.assign(Object.assign({}, account.customClaims), { role }));
    return true;
}
// Profile + audit are committed atomically by the Next API. This durable event
// retries claim synchronization independently if the API's immediate sync fails.
exports.onRoleChangeAuditCreate = functions.runWith({ failurePolicy: true }).firestore
    .document('roleChangeAudit/{eventId}')
    .onCreate(async (snap) => {
    var _a;
    const targetUid = (_a = snap.data()) === null || _a === void 0 ? void 0 : _a.targetUid;
    if (typeof targetUid !== 'string' || !targetUid || targetUid.includes('/'))
        return;
    const complete = await synchronizeProfileRole(targetUid);
    await snap.ref.update({ claimsSync: complete ? 'complete' : 'blocked' });
});
// This Cloud Function is triggered when a user's document in Firestore is created.
// Its purpose is to set a custom claim (`role`) on the user's authentication token.
// This allows Firestore Security Rules to perform role-based access control efficiently
// by reading the role directly from the request.auth.token object, which is much
// faster and more scalable than reading from the Firestore document.
exports.onUserCreate = functions.firestore
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
    if ((0, user_roles_1.isUserRole)(role)) {
        try {
            await synchronizeProfileRole(userId);
            console.log(`Role claims synchronized for user ${userId}`);
        }
        catch (error) {
            console.error(`Failed to set custom claim for user ${userId}:`, error);
        }
    }
});
// Admin-only callable to create a user without affecting the caller's session
exports.adminCreateUser = functions.https.onCall(async (data, context) => {
    var _a;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }
    let callerRole;
    try {
        const profile = await admin.firestore().doc(`users/${context.auth.uid}`).get();
        callerRole = profile.exists ? (_a = profile.data()) === null || _a === void 0 ? void 0 : _a.role : undefined;
    }
    catch (_b) {
        throw new functions.https.HttpsError('permission-denied', 'Unable to verify current admin privileges.');
    }
    // Callable account creation requires a current admin profile, never stale claims.
    if (callerRole !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Admin privileges required.');
    }
    const email = (data && data.email) || '';
    const password = (data && data.password) || '';
    const fullName = (data && data.fullName) || '';
    const userRole = (data === null || data === void 0 ? void 0 : data.role) === undefined ? 'student' : data.role;
    if (typeof email !== 'string' || typeof password !== 'string' || typeof fullName !== 'string' || !email || !password || !fullName.trim() || !(0, user_roles_1.isUserRole)(userRole)) {
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
    }
    catch (err) {
        console.error('adminCreateUser failed:', err);
        throw new functions.https.HttpsError('internal', (err === null || err === void 0 ? void 0 : err.message) || 'Failed to create user');
    }
});
// This Cloud Function is triggered when a user's document in Firestore is updated.
// It checks if the 'role' field has changed. If it has, it updates the custom
// claim on the user's authentication token to reflect the new role. This ensures
// that the security rules always have the most up-to-date role information.
exports.onUserUpdate = functions.firestore
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
    if ((0, user_roles_1.isUserRole)(newRole) && newRole !== oldRole) {
        try {
            await synchronizeProfileRole(userId);
            console.log(`Role claims synchronized for user ${userId}`);
        }
        catch (error) {
            console.error(`Failed to update custom claim for user ${userId}:`, error);
        }
    }
});
//# sourceMappingURL=index.js.map