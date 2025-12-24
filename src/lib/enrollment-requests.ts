'use client';

import { deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import type { EnrollmentRequest, EnrollmentRequestStatus } from '@/types/models';

const { auth, firestore } = initializeFirebase();

export function enrollmentRequestDoc(userId: string, courseId: string) {
  return doc(firestore, 'users', userId, 'enrollmentRequests', courseId);
}

export async function requestEnrollment(opts: {
  userId: string;
  courseId: string;
  courseTitle?: string | null;
  courseCode?: string | null;
}) {
  const { userId, courseId, courseTitle, courseCode } = opts;
  if (!userId || !courseId) throw new Error('Missing userId or courseId.');

  const currentUser = auth.currentUser;
  const userEmail = currentUser?.email || null;
  const userName = currentUser?.displayName || null;

  const ref = enrollmentRequestDoc(userId, courseId);
  const payload: Omit<EnrollmentRequest, 'id'> = {
    userId,
    userEmail,
    userName,
    courseId,
    courseTitle: courseTitle ?? null,
    courseCode: courseCode ?? null,
    status: 'PENDING',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  // Firestore rules allow students to create/delete their own requests, but not update them.
  // To support "request again" flows, delete any existing request first and then create a new one.
  try {
    await deleteDoc(ref);
  } catch {
    // Ignore if missing or not permitted; setDoc will surface permission errors if any.
  }

  await setDoc(ref, payload);
}

export async function cancelEnrollmentRequest(userId: string, courseId: string) {
  if (!userId || !courseId) throw new Error('Missing userId or courseId.');
  await deleteDoc(enrollmentRequestDoc(userId, courseId));
}

export async function setEnrollmentRequestStatus(opts: {
  userId: string;
  courseId: string;
  status: EnrollmentRequestStatus;
}) {
  const { userId, courseId, status } = opts;
  if (!userId || !courseId) throw new Error('Missing userId or courseId.');
  await updateDoc(enrollmentRequestDoc(userId, courseId), {
    status,
    ...(status === 'APPROVED' ? { approvedAt: serverTimestamp() } : {}),
    ...(status === 'REJECTED' ? { rejectedAt: serverTimestamp() } : {}),
    updatedAt: serverTimestamp(),
  });
}
