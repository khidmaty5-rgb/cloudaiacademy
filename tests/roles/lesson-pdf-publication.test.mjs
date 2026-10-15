import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../../src/app/api/courses/[courseId]/lessons/[lessonId]/pdf/route.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function route(role,status,assigned=false) {
  const reads=[];
  const mocks={
    'next/server':{NextResponse:{json:(body,options)=>({body,...options})}},
    'firebase-admin/app':{getApps:()=>[{name:'adminAppLessonPdfDownload'}]},
    'firebase-admin/auth':{getAuth:()=>({verifyIdToken:async()=>({uid:'actor'})})},
    'firebase-admin/firestore':{getFirestore:()=>({doc:path=>({get:async()=>{
      reads.push(path);
      if(path==='courses/qa')return{exists:true,data:()=>({status,price:'Free',ownerId:assigned?'actor':'other'})};
      if(path.includes('/lessons/'))return{exists:false};
      return{exists:true,data:()=>({})};
    }})})},
    '@aws-sdk/client-s3':{},'@aws-sdk/s3-request-presigner':{},'@/lib/s3':{},'@/firebase/config':{},
    '@/lib/course-price':{isPriceFree:()=>true},'@/lib/roles':{isLearnerRole:role=>['student','reviewer'].includes(role)},
    '@/server/effective-user-role':{getEffectiveUserRole:async()=>role},
  };
  const module={exports:{}};
  new Function('require','module','exports',compiled)(name=>{if(!(name in mocks))throw Error(name);return mocks[name];},module,module.exports);
  return{reads,run:()=>module.exports.GET({headers:new Headers({authorization:'Bearer fixture'})},{params:Promise.resolve({courseId:'qa',lessonId:'one'})})};
}
test('PDF route denies unpublished content to enrolled learners before reading lessons or signing URLs',async()=>{
  for(const role of ['student','reviewer','teacher'])for(const status of ['DRAFT',undefined,null,'UNKNOWN']) {
    const fixture=route(role,status);assert.equal((await fixture.run()).status,403);
    assert.deepEqual(fixture.reads,['courses/qa']);
  }
});
test('PDF route preserves published learner and draft instructor authorization',async()=>{
  for(const [role,status,assigned] of [['student','PUBLISHED',false],['admin','DRAFT',false],['teacher','DRAFT',true]]) {
    const fixture=route(role,status,assigned);const result=await fixture.run();
    assert.equal(result.status,404);assert.equal(result.body.error,'Lesson not found');
    assert.ok(fixture.reads.includes('courses/qa/lessons/one'));
  }
});
