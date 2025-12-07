'use client';

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';

const { firestore } = initializeFirebase();

type AnnouncementData = {
  title: string;
  body: string;
  createdBy: string;
};

export async function createAnnouncement(data: AnnouncementData) {
  if (!data.title || !data.body || !data.createdBy) {
    throw new Error('Title, body, and creator ID are required.');
  }

  const announcementsRef = collection(firestore, 'announcements');

  await addDoc(announcementsRef, {
    ...data,
    createdAt: serverTimestamp(),
  });
}
    