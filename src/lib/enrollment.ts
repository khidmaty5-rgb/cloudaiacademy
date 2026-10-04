'use client';

import { doc, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import type { Enrollment } from '@/types/models';

const { firestore } = initializeFirebase();

export async function enrollInCourse(userId: string, courseId: string) {
  if (!userId || !courseId) {
    throw new Error('User ID and Course ID are required to enroll.');
  }

  const enrollmentRef = doc(firestore, 'users', userId, 'enrollments', courseId);
  
  await runTransaction(firestore, async transaction => {
    const existing = await transaction.get(enrollmentRef);
    if (existing.exists()) return;
    transaction.set(enrollmentRef, {
      userId,
      courseId,
      enrollmentDate: serverTimestamp(),
      progress: 0,
      completedLessons: [],
    } satisfies Enrollment);
  });
}


export async function updateUserProgress(userId: string, courseId: string, newProgress: number, completedLessons: string[]) {
    if (!userId || !courseId) {
        throw new Error('User ID and Course ID are required to update progress.');
    }

    const enrollmentRef = doc(firestore, 'users', userId, 'enrollments', courseId);

    await updateDoc(enrollmentRef, {
        progress: newProgress,
        completedLessons: completedLessons,
    } satisfies Partial<Enrollment>);
}
