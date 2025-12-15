'use client';

import {
  doc,
  updateDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';

const { firestore } = initializeFirebase();

export type Lesson = {
  id: string;
  title: string;
  content: string;
  title_ar?: string;
  content_ar?: string;
  embedUrl?: string;
  order?: number;
  // Optional integrations per lesson
  whiteboardPlatform?: 'excalidraw' | 'miro' | 'ms-whiteboard';
  whiteboardUrl?: string;
  codingPlatform?: 'replit' | 'codesandbox' | 'stackblitz' | 'colab' | 'livecodes';
  codingUrl?: string;
  labPlatform?: 'labex' | 'whizlabs' | 'vmware-hol' | 'virtual-labs';
  labUrl?: string;
};


type LessonData = {
  title: string;
  content: string;
  title_ar?: string;
  content_ar?: string;
  embedUrl?: string;
  order?: number;
  // Optional integrations per lesson
  whiteboardPlatform?: 'excalidraw' | 'miro' | 'ms-whiteboard';
  whiteboardUrl?: string;
  codingPlatform?: 'replit' | 'codesandbox' | 'stackblitz' | 'colab' | 'livecodes';
  codingUrl?: string;
  labPlatform?: 'labex' | 'whizlabs' | 'vmware-hol' | 'virtual-labs';
  labUrl?: string;
};

// Helper to create a slug from a title, can be used for lesson IDs
const createId = (title: string) => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

export async function addLesson(courseId: string, data: LessonData) {
  if (!courseId) {
    throw new Error('Course ID is required to add a lesson.');
  }
  const lessonId = createId(data.title);
  const lessonsRef = doc(firestore, 'courses', courseId, 'lessons', lessonId);

  await setDoc(lessonsRef, {
    ...data,
    id: lessonId,
    createdAt: serverTimestamp(),
  });
}

export async function updateLesson(
  courseId: string,
  lessonId: string,
  data: Partial<LessonData>
) {
  if (!courseId || !lessonId) {
    throw new Error('Course ID and Lesson ID are required for updates.');
  }

  const lessonDocRef = doc(firestore, 'courses', courseId, 'lessons', lessonId);
  await updateDoc(lessonDocRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

