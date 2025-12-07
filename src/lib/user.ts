'use client';

import { updateProfile, User } from 'firebase/auth';
import { doc, setDoc, updateDoc, collection, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import type { PersonalizedLearningPathOutput } from '@/ai/flows/personalized-learning-paths';
import { getFunctions, httpsCallable } from 'firebase/functions';

const { auth, firestore } = initializeFirebase();

type UserProfileData = {
  firstName: string;
  lastName: string;
};

// This function creates a user from the admin panel, not the public sign-up
export async function createUserWithRole(email: string, password: string, fullName: string, role: 'student' | 'teacher' | 'admin') {
    // Try callable function first (prod with Functions). If unavailable (no Blaze), fallback to Next API route.
    try {
        const functions = getFunctions();
        const createFn = httpsCallable(functions, 'adminCreateUser');
        await createFn({ email, password, fullName, role });
        return;
    } catch (err) {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            throw new Error('You must be signed in as an admin.');
        }
        const token = await currentUser.getIdToken();
        const resp = await fetch('/api/admin/create-user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ email, password, fullName, role })
        });
        if (!resp.ok) {
            let msg = 'Failed to create user.';
            try {
                const j = await resp.json();
                if (j?.error) msg = j.error;
            } catch {}
            throw new Error(msg);
        }
    }
}

export async function updateUserProfile(user: User, data: UserProfileData) {
  const fullName = `${data.firstName} ${data.lastName}`.trim();

  // Update Firebase Auth profile
  await updateProfile(user, {
    displayName: fullName,
  });

  const userDocRef = doc(firestore, 'users', user.uid);
  const userDoc = await getDoc(userDocRef);
  const currentRole = userDoc.data()?.role || 'student';

  // Update Firestore user document, including re-saving the role.
  // This is CRITICAL to trigger the onUserUpdate Cloud Function which sets custom claims for existing users.
  await updateDoc(userDocRef, {
    firstName: data.firstName,
    lastName: data.lastName,
    role: currentRole, // Re-assert the role to trigger the update function
  });

  await user.getIdToken(true);
}

export async function saveLearningPath(userId: string, path: PersonalizedLearningPathOutput) {
    if (!userId) {
        throw new Error('User ID is required to save a learning path.');
    }

    const learningPathsRef = collection(firestore, 'users', userId, 'learningPaths');

    await addDoc(learningPathsRef, {
        userId,
        ...path,
        createdAt: serverTimestamp(),
    });
}

export async function updateUserRole(userId: string, role: 'student' | 'teacher' | 'admin') {
  if (!userId) {
    throw new Error('User ID is required.');
  }
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in as an admin.');
  }
  const token = await currentUser.getIdToken();
  const resp = await fetch('/api/admin/update-user-role', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ userId, role }),
  });
  if (!resp.ok) {
    let msg = 'Failed to update user role.';
    try {
      const j = await resp.json();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
}
