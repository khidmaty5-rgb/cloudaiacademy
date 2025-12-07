'use client';

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  signOut,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';

const { auth, firestore } = initializeFirebase();

export async function signUp(email: string, password: string, fullName: string) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  const nameParts = fullName.split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ');

  await updateProfile(user, {
    displayName: fullName,
  });

  // Default role for all public sign-ups is 'student'
  let userRole = 'student';

  // Special one-time rule to create the first admin user.
  // This should be removed after the first admin has been created.
  if (email.toLowerCase() === 'dhnos@hotmail.com') {
    userRole = 'admin';
  }

  await setDoc(doc(firestore, 'users', user.uid), {
    id: user.uid,
    firstName: firstName,
    lastName: lastName,
    email: user.email,
    dateJoined: serverTimestamp(),
    role: userRole,
  });

  return user;
}

export async function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signOutUser() {
  return signOut(auth);
}
