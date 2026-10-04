import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const stub = moduleUrl(`
export const records = new Map();
let next = 0;
export const collection = (_, ...parts) => ({ path: parts.join('/') });
export const doc = (parent, ...parts) => { const path = parts.length ? parts.join('/') : parent.path + '/auto-' + (++next); return {path, id: path.split('/').at(-1)}; };
export const serverTimestamp = () => 'timestamp';
export const setDoc = async (ref, data) => records.set(ref.path, structuredClone(data));
export const updateDoc = async (ref, data) => records.set(ref.path, {...records.get(ref.path), ...data});
export const runTransaction = async (_, fn) => fn({get: async ref => ({exists: () => records.has(ref.path)}), set: (ref, data) => records.set(ref.path, structuredClone(data))});
`);
const firebase = moduleUrl('export const initializeFirebase = () => ({firestore: {}});');
async function load(name) {
  const source = await readFile(new URL(`../../src/lib/${name}.ts`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText;
  return import(moduleUrl(compiled.replaceAll('firebase/firestore', stub).replaceAll('@/firebase', firebase)));
}
const {records} = await import(stub);
const {addLesson, updateLesson} = await load('lessons');
const {enrollInCourse} = await load('enrollment');

test('duplicate and Arabic lesson titles receive separate IDs without overwriting existing lessons', async () => {
  records.clear();
  records.set('courses/course/lessons/introduction', {title: 'Original'});
  await addLesson('course', {title: 'Introduction', content: 'first'});
  await addLesson('course', {title: 'Introduction', content: 'second'});
  await addLesson('course', {title: 'مقدمة في التعلم', content: 'محتوى الدرس'});
  assert.equal(records.size, 4);
  assert.equal(records.get('courses/course/lessons/introduction').title, 'Original');
  const added = [...records.values()].filter(record => record.id);
  assert.equal(new Set(added.map(record => record.id)).size, 3);
  assert.equal(added[2].title, 'مقدمة في التعلم');
  await updateLesson('course', added[0].id, {title: 'Revised'});
  assert.equal(records.size, 4);
  assert.equal(records.get(`courses/course/lessons/${added[0].id}`).title, 'Revised');
});

test('enrollment creates once and repeat enrollment preserves progress and metadata', async () => {
  records.clear();
  await enrollInCourse('student', 'course');
  const path = 'users/student/enrollments/course';
  assert.deepEqual(records.get(path), {userId: 'student', courseId: 'course', enrollmentDate: 'timestamp', progress: 0, completedLessons: []});
  const existing = {...records.get(path), progress: 70, completedLessons: ['lesson-1'], enrollmentDate: 'original-date', certificateId: 'keep'};
  records.set(path, existing);
  await enrollInCourse('student', 'course');
  assert.deepEqual(records.get(path), existing);
});

test('missing record identifiers reject without writing', async () => {
  records.clear();
  await assert.rejects(addLesson('', {title: 'Example', content: 'text'}));
  await assert.rejects(enrollInCourse('', 'course'));
  assert.equal(records.size, 0);
});
