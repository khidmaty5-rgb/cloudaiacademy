'use client';

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';

const { firestore } = initializeFirebase();

// Helper to create a slug from a title
const createSlug = (title: string) => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

const generateImageId = (title: string) => {
    return `course-${createSlug(title)}`;
}

// Data type for course creation/update
type CourseData = {
  title: string;
  description: string;
  category: string;
  price: string;
  duration: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
};

export async function addCourse(data: CourseData) {
  const slug = createSlug(data.title);
  const imageId = generateImageId(data.title);
  
  // Use the slug as the document ID for predictability
  const courseDocRef = doc(firestore, 'courses', slug);

  await setDoc(courseDocRef, {
    ...data,
    slug: slug,
    id: slug, // Use slug as id
    imageId: imageId,
    createdAt: serverTimestamp(),
  });
}

export async function updateCourse(courseId: string, data: Partial<CourseData>) {
  if (!courseId) {
    throw new Error('Course ID is required for updates.');
  }

  const courseDocRef = doc(firestore, 'courses', courseId);
  await updateDoc(courseDocRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}
