import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { before, after, test } from 'node:test';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, doc, setDoc, getDocs, query, orderBy, documentId, limit, startAfter } from 'firebase/firestore';
let env;
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-people-pagination', firestore: { rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8') } });
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'users/admin'), { role: 'admin' });
    await setDoc(doc(db, 'users/student'), { role: 'student' });
    await Promise.all(Array.from({ length: 105 }, (_, i) => setDoc(doc(db, `users/person-${String(i).padStart(3, '0')}`), { role: 'student', dateJoined: new Date(2026, 0, 1), email: `person${i}@example.invalid` })));
  });
});
after(async () => env?.cleanup());
const peopleQuery = (db, cursor) => query(collection(db, 'users'), orderBy('dateJoined', 'desc'), orderBy(documentId(), 'desc'), ...(cursor ? [startAfter(cursor.dateJoined, cursor.id)] : []), limit(51));
test('bounded admin paging remains stable when join dates tie', async () => {
  const db = env.authenticatedContext('admin', { role: 'admin' }).firestore();
  let cursor, ids = [];
  for (let i = 0; i < 3; i++) {
    const snapshot = await assertSucceeds(getDocs(peopleQuery(db, cursor)));
    assert.ok(snapshot.size <= 51);
    const page = snapshot.docs.slice(0, 50);
    ids.push(...page.map(row => row.id));
    const last = page.at(-1);
    cursor = { dateJoined: last.data().dateJoined, id: last.id };
  }
  assert.equal(ids.length, 105);
  assert.equal(new Set(ids).size, 105);
});
test('paging does not expose the directory to students or stale admin claims', async () => {
  for (const role of ['student', 'admin']) {
    const db = env.authenticatedContext('student', { role }).firestore();
    await assertFails(getDocs(peopleQuery(db)));
  }
});
