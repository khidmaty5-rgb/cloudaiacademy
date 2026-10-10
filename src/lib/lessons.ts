'use client';

import {
  doc,
  collection,
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
  richContent?: string;
  lessonType?: 'interactive-html';
  interactiveHtml?: string;
  importLinks?: Record<string, string>;
  title_ar?: string;
  content_ar?: string;
  embedUrl?: string;
  pdfPath?: string | null;
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
  pdfPath?: string | null;
  order?: number;
  // Optional integrations per lesson
  whiteboardPlatform?: 'excalidraw' | 'miro' | 'ms-whiteboard';
  whiteboardUrl?: string;
  codingPlatform?: 'replit' | 'codesandbox' | 'stackblitz' | 'colab' | 'livecodes';
  codingUrl?: string;
  labPlatform?: 'labex' | 'whizlabs' | 'vmware-hol' | 'virtual-labs';
  labUrl?: string;
};

export async function addLesson(courseId: string, data: LessonData) {
  if (!courseId) {
    throw new Error('Course ID is required to add a lesson.');
  }
  // Titles are content, not identifiers: repeated or Arabic titles must never
  // overwrite an existing lesson. Existing lesson IDs and URLs are unchanged.
  const lessonsRef = doc(collection(firestore, 'courses', courseId, 'lessons'));

  await setDoc(lessonsRef, {
    ...data,
    id: lessonsRef.id,
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

