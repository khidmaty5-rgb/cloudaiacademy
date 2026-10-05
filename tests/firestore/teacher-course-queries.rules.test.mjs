import { readFile } from 'node:fs/promises';
import { before, after, test } from 'node:test';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, doc, setDoc, getDocs, getDoc, query, where } from 'firebase/firestore';

let env;
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-teacher-course-queries',
    firestore: { rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8') } });
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (const role of ['teacher', 'student', 'reviewer', 'editor', 'admin']) {
      await setDoc(doc(db, 'users', role), { role });
    }
    await setDoc(doc(db, 'courses', 'owned'), { ownerId: 'teacher', status: 'DRAFT' });
    await setDoc(doc(db, 'courses', 'assigned'), { instructorIds: ['teacher'], status: 'DRAFT' });
    await setDoc(doc(db, 'courses', 'other'), { ownerId: 'other', instructorIds: [], status: 'DRAFT' });
    await setDoc(doc(db, 'courses', 'assigned', 'lessons', 'one'), { title: 'Assigned lesson' });
    await setDoc(doc(db, 'courses', 'other', 'lessons', 'one'), { title: 'Other lesson' });
  });
});
after(async () => env?.cleanup());
const dbFor = role => env.authenticatedContext(role, { role }).firestore();
test('teacher can list owned courses using the actual dashboard query', async () => {
  const db = dbFor('teacher');
  await assertSucceeds(getDocs(query(collection(db, 'courses'), where('ownerId', '==', 'teacher'))));
});
test('teacher can list assigned courses even without ownerId', async () => {
  const db = dbFor('teacher');
  await assertSucceeds(getDocs(query(collection(db, 'courses'), where('instructorIds', 'array-contains', 'teacher'))));
  await assertSucceeds(getDoc(doc(db, 'courses', 'assigned', 'lessons', 'one')));
  await assertSucceeds(setDoc(doc(db, 'courses', 'assigned', 'lessons', 'two'), { title: 'Authorized lesson' }));
  await assertFails(setDoc(doc(db, 'courses', 'assigned'), { ownerId: 'teacher', status: 'PUBLISHED' }));
});
test('teacher cannot list all courses or read another instructor draft or lessons', async () => {
  const db = dbFor('teacher');
  await assertFails(getDocs(collection(db, 'courses')));
  await assertFails(getDoc(doc(db, 'courses', 'other')));
  await assertFails(getDoc(doc(db, 'courses', 'other', 'lessons', 'one')));
  await assertFails(setDoc(doc(db, 'courses', 'other', 'lessons', 'two'), { title: 'Forbidden' }));
});
test('non-teaching roles cannot query another instructor drafts', async () => {
  for (const role of ['student', 'reviewer', 'editor']) {
    const db = dbFor(role);
    await assertFails(getDocs(query(collection(db, 'courses'), where('ownerId', '==', 'teacher'))));
  }
});
test('admin can list all courses', async () => {
  await assertSucceeds(getDocs(collection(dbFor('admin'), 'courses')));
});
