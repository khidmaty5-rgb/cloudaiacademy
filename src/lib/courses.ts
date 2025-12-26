'use client';

import {
  collection,
  doc,
  updateDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { getAuth } from 'firebase/auth';
import type { Course, CourseLevel } from '@/types/models';

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

const removeUndefined = <T extends Record<string, any>>(obj: T): Partial<T> => {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
};

type CourseData = Pick<Course, 'title' | 'description' | 'category' | 'price' | 'duration'> & {
  courseCode?: Course['courseCode'];
  isFull?: Course['isFull'];
  totalHours?: Course['totalHours'];
  imageUrl?: Course['imageUrl'];
  level: CourseLevel;
  livePlatform?: Course['livePlatform'];
  liveJitsiRoom?: Course['liveJitsiRoom'];
  liveMeetUrl?: Course['liveMeetUrl'];
};

export async function addCourse(data: CourseData, extra?: Partial<Pick<Course, 'ownerId' | 'instructorIds'>>) {
  const slug = createSlug(data.title);
  const imageId = generateImageId(data.title);
  const uid = getAuth().currentUser?.uid;
  const courseCode = data.courseCode ? data.courseCode.trim().toUpperCase() : undefined;
  const imageUrl = data.imageUrl ? data.imageUrl.trim() : undefined;
  const totalHours =
    typeof data.totalHours === 'number' && Number.isFinite(data.totalHours)
      ? data.totalHours
      : undefined;
  
  // Use the slug as the document ID for predictability
  const courseDocRef = doc(firestore, 'courses', slug);

  const base = {
    ...data,
    imageUrl: imageUrl || undefined,
    slug,
    id: slug,
    imageId,
    ...(courseCode ? { courseCode } : {}),
    ...(data.isFull === true ? { isFull: true } : {}),
    ...(typeof totalHours === 'number' ? { totalHours } : {}),
    livePlatform: data.livePlatform ?? 'none',
    liveJitsiRoom: data.livePlatform === 'jitsi' ? (data.liveJitsiRoom ?? null) : null,
    liveMeetUrl: data.livePlatform === 'google-meet' ? (data.liveMeetUrl ?? null) : null,
    createdAt: serverTimestamp(),
  } as Record<string, any>;

  const extraNormalized: Partial<Pick<Course, 'ownerId' | 'instructorIds'>> =
    extra && (typeof extra.ownerId === 'string' || Array.isArray(extra.instructorIds))
      ? {
          ...(typeof extra.ownerId === 'string' ? { ownerId: extra.ownerId } : {}),
          ...(Array.isArray(extra.instructorIds) ? { instructorIds: extra.instructorIds } : {}),
        }
      : (uid ? { ownerId: uid, instructorIds: [uid] } : {});

  await setDoc(courseDocRef, removeUndefined({ ...base, ...extraNormalized }) as Omit<Course, 'updatedAt'>);
}

export async function updateCourse(courseId: string, data: Partial<CourseData & Pick<Course, 'ownerId' | 'instructorIds'>>) {
  if (!courseId) {
    throw new Error('Course ID is required for updates.');
  }

  const courseDocRef = doc(firestore, 'courses', courseId);
  const totalHours =
    typeof (data as any).totalHours === 'number' && Number.isFinite((data as any).totalHours)
      ? (data as any).totalHours
      : undefined;
  const normalized = {
    ...data,
    ...(data.courseCode ? { courseCode: data.courseCode.trim().toUpperCase() } : {}),
    ...(typeof (data as any).isFull === 'boolean' ? { isFull: (data as any).isFull } : {}),
    ...(typeof (data as any).imageUrl === 'string' ? { imageUrl: (data as any).imageUrl.trim() || undefined } : {}),
    ...(typeof totalHours === 'number' ? { totalHours } : {}),
  } as Record<string, any>;
  const sanitized = removeUndefined(normalized);
  await updateDoc(courseDocRef, {
    ...sanitized,
    updatedAt: serverTimestamp(),
  });
}
