import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { before, after, test } from 'node:test';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';

let env;
before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw Error('Local Firestore emulator required');
  env = await initializeTestEnvironment({projectId:'demo-course-lifecycle',firestore:{rules:await readFile(new URL('../../firestore.rules',import.meta.url),'utf8')}});
  await env.withSecurityRulesDisabled(async context => {
    for (const role of ['admin','teacher','student','other'])
      await setDoc(doc(context.firestore(),'users',role),{role:role==='other'?'student':role});
  });
});
after(async () => env?.cleanup());
const dbFor = role => env.authenticatedContext(role,{role:role==='other'?'student':role}).firestore();

test('course persists through creation, assignment, publication, enrollment, progress and certificate records',async () => {
  const admin=dbFor('admin'),teacher=dbFor('teacher'),student=dbFor('student');
  const course={title:'QA دورة',status:'DRAFT',price:'Free',isFull:false,imageUrl:'data:image/jpeg;base64,/9j/2Q==',instructorIds:[]};
  await assertSucceeds(setDoc(doc(admin,'courses','qa'),course));
  assert.equal((await getDoc(doc(admin,'courses','qa'))).data().imageUrl,course.imageUrl);
  await assertFails(getDoc(doc(teacher,'courses','qa')));
  await assertSucceeds(updateDoc(doc(admin,'courses','qa'),{ownerId:'teacher',instructorIds:['teacher']}));
  await assertSucceeds(getDoc(doc(teacher,'courses','qa')));
  await assertSucceeds(setDoc(doc(teacher,'courses','qa','lessons','one'),{title:'Lesson / درس',content:'QA lesson'}));
  await assertFails(getDoc(doc(student,'courses','qa','lessons','one')));
  await assertSucceeds(updateDoc(doc(admin,'courses','qa'),{status:'PUBLISHED',livePlatform:'jitsi',liveJitsiRoom:'qa-test-not-opened'}));
  await assertSucceeds(setDoc(doc(student,'users','student','enrollments','qa'),{userId:'student',courseId:'qa',progress:0,completedLessons:[]}));
  await assertSucceeds(getDoc(doc(student,'courses','qa','lessons','one')));
  await assertSucceeds(updateDoc(doc(student,'users','student','enrollments','qa'),{progress:100,completedLessons:['one']}));
  assert.equal((await getDoc(doc(student,'users','student','enrollments','qa'))).data().progress,100);
  await assertFails(updateDoc(doc(dbFor('other'),'users','student','enrollments','qa'),{progress:0}));
  const cert={userId:'student',courseId:'qa',title:'QA certificate'};
  await assertFails(setDoc(doc(student,'certificates','qa-cert'),cert));
  await assertSucceeds(setDoc(doc(admin,'certificates','qa-cert'),cert));
  await assertSucceeds(setDoc(doc(admin,'users','student','certificates','qa-cert'),cert));
  await assertSucceeds(getDoc(doc(student,'users','student','certificates','qa-cert')));
  await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(),'certificates','qa-cert')));
});

test('a student cannot self-enroll into an unpublished draft by its known ID',async () => {
  await setDoc(doc(dbFor('admin'),'courses','private-draft'),{title:'Private draft',status:'DRAFT',price:'Free',isFull:false});
  await assertFails(setDoc(doc(dbFor('student'),'users','student','enrollments','private-draft'),{userId:'student',courseId:'private-draft',progress:0,completedLessons:[]}));
});

test('unpublishing blocks existing enrollment and purchase access but preserves staff access and progress',async () => {
  const admin=dbFor('admin'),student=dbFor('student');
  await setDoc(doc(admin,'courses','return-to-draft'),{status:'PUBLISHED',price:'Free',isFull:false,ownerId:'teacher'});
  await setDoc(doc(admin,'courses','return-to-draft','lessons','one'),{title:'Private when unpublished'});
  const enrollment=doc(student,'users','student','enrollments','return-to-draft');
  await setDoc(enrollment,{userId:'student',courseId:'return-to-draft',progress:50,completedLessons:['one']});
  await setDoc(doc(admin,'users','student','coursePurchases','return-to-draft'),{status:'PAID'});
  await updateDoc(doc(admin,'courses','return-to-draft'),{status:'DRAFT'});
  await assertFails(getDoc(doc(student,'courses','return-to-draft')));
  await assertFails(getDoc(doc(student,'courses','return-to-draft','lessons','one')));
  await assertFails(getDocs(collection(student,'courses','return-to-draft','lessons')));
  await assertFails(updateDoc(enrollment,{progress:100}));
  assert.equal((await getDoc(enrollment)).data().progress,50);
  await assertSucceeds(getDoc(doc(dbFor('teacher'),'courses','return-to-draft','lessons','one')));
  await assertSucceeds(getDoc(doc(admin,'courses','return-to-draft')));
  await updateDoc(doc(admin,'courses','return-to-draft'),{status:'PUBLISHED'});
  await assertSucceeds(getDoc(doc(student,'courses','return-to-draft','lessons','one')));
  await assertSucceeds(updateDoc(enrollment,{progress:100}));
  await assertFails(updateDoc(enrollment,{courseId:'private-draft'}));
  await assertSucceeds(getDocs(query(collection(student,'courses'),where('status','==','PUBLISHED'))));
});

test('waitlist approval and missing status cannot bypass publication',async () => {
  const admin=dbFor('admin'),student=dbFor('student');
  for(const status of ['DRAFT',null]) {
    const id=status?'full-draft':'missing-status';
    await setDoc(doc(admin,'courses',id),{...(status?{status}:{}),price:'Free',isFull:true});
    await assertFails(setDoc(doc(student,'users','student','enrollmentRequests',id),{userId:'student',courseId:id,status:'PENDING'}));
    await env.withSecurityRulesDisabled(context=>setDoc(doc(context.firestore(),'users','student','enrollmentRequests',id),{userId:'student',courseId:id,status:'APPROVED'}));
    await assertFails(setDoc(doc(student,'users','student','enrollments',id),{userId:'student',courseId:id,progress:0,completedLessons:[]}));
  }
});
