'use client';

import { getFirestore, doc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';

const { firestore } = initializeFirebase();

export async function enrollInCourse(userId: string, courseId: string) {
  if (!userId || !courseId) {
    throw new Error('User ID and Course ID are required to enroll.');
  }

  const enrollmentRef = doc(firestore, 'users', userId, 'enrollments', courseId);
  
  await setDoc(enrollmentRef, {
    userId,
    courseId,
    enrollmentDate: serverTimestamp(),
    progress: 0,
    completedLessons: [],
  }, { merge: true });
}


export async function updateUserProgress(userId: string, courseId: string, newProgress: number, completedLessons: string[]) {
    if (!userId || !courseId) {
        throw new Error('User ID and Course ID are required to update progress.');
    }

    const enrollmentRef = doc(firestore, 'users', userId, 'enrollments', courseId);

    await updateDoc(enrollmentRef, {
        progress: newProgress,
        completedLessons: completedLessons,
    });
}
