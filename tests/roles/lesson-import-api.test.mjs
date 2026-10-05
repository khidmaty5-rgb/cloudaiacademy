
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const url=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
async function compile(path,replacements={}) {let source=ts.transpileModule(await readFile(new URL('../../'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText; for(const [a,b] of Object.entries(replacements))source=source.replaceAll(a,b); return url(source);}
const fake=url(`
export const records=new Map();
export const Timestamp={now:()=>Timestamp.fromMillis(Date.now()),fromMillis:value=>({toMillis:()=>value})};
const snap=(path)=>({id:path.split('/').at(-1),exists:records.has(path),data:()=>records.get(path)});
function ref(path) {return {path,id:path.split('/').at(-1),collection:name=>query(path+'/'+name),get:async()=>snap(path)};}
function query(path,sort,count=Infinity) {return {path,doc:id=>ref(path+'/'+id),orderBy:field=>query(path,field,count),limit:n=>query(path,sort,n),get:async()=>({docs:[...records.keys()].filter(k=>k.startsWith(path+'/')&&!k.slice(path.length+1).includes('/')).map(snap).sort((a,b)=>sort?(b.data()[sort]?.toMillis?.()||0)-(a.data()[sort]?.toMillis?.()||0):0).slice(0,count)})};}
export const db={doc:ref,runTransaction:async fn=>{const writes=[];const result=await fn({get:r=>r.get(),create:(r,d)=>writes.push(['create',r.path,d]),update:(r,d)=>writes.push(['update',r.path,d])});for(const [kind,path] of writes)if(kind==='create'&&records.has(path))throw Error('already exists');for(const [kind,path,data] of writes)records.set(path,kind==='create'?data:{...records.get(path),...data});return result;}};
export const getFirestore=()=>db;
export const getAuth=()=>({verifyIdToken:async token=>{if(!['admin','teacher','student'].includes(token))throw Error('invalid');return {uid:token,role:token};}});
export const getApps=()=>[{}];
export const initializeApp=()=>({});
export const cert=()=>({});
export const applicationDefault=()=>({});
`);
const policy=await compile('src/server/lesson-import-policy.ts');
const effective=await compile('src/server/effective-user-role.ts');
const pkg=await compile('src/lib/lesson-package.ts');
const routeUrl=await compile('src/app/api/courses/[courseId]/lesson-imports/route.ts',{
  'firebase-admin/app':fake,'firebase-admin/auth':fake,'firebase-admin/firestore':fake,
  '@/firebase/config':url('export const firebaseConfig={projectId:"test"};'),
  '@/server/effective-user-role':effective,'@/server/lesson-import-policy':policy,'@/lib/lesson-package':pkg,
  'next/server':import.meta.resolve('next/server.js')
});
const {POST,GET}=await import(routeUrl);
const {records,Timestamp}=await import(fake);
const context={params:Promise.resolve({courseId:'course'})};
const id='11111111-1111-4111-8111-111111111111';
const payload={action:'save',importId:id,name:'Example.zip',lessons:[{key:'l0',title:'First',nodes:[{tag:'p',children:[{text:'First lesson content'}]}]},{key:'l1',title:'Second',nodes:[{text:'Second lesson content'}]}]};
function seed(){records.clear();records.set('courses/course',{ownerId:'teacher'});records.set('courses/course/lessons/existing',{id:'existing',title:'Keep me',createdAt:Timestamp.fromMillis(1)});}
function request(data,token='admin') {return new Request('https://example.test/api/courses/course/lesson-imports',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(data)});}
test('draft save stays out of published lessons; publishing is atomic and retry-safe',async()=>{
  seed();
  assert.equal((await POST(request(payload),context)).status,200);
  assert.equal([...records.keys()].filter(k=>k.startsWith('courses/course/lessons/')).length,1);
  assert.equal(records.get('courses/course/lessonImports/'+id).status,'DRAFT');
  assert.equal((await POST(request(payload),context)).status,200);
  const publish={action:'publish',importId:id};
  assert.equal((await POST(request(publish),context)).status,200);
  assert.equal((await POST(request(publish),context)).status,200);
  assert.equal([...records.keys()].filter(k=>k.startsWith('courses/course/lessons/')).length,3);
  assert.equal(records.get('courses/course/lessons/existing').title,'Keep me');
  assert.ok(records.get('courses/course/lessons/'+id+'_l1').createdAt.toMillis()>records.get('courses/course/lessons/'+id+'_l0').createdAt.toMillis());
});
test('invalid token, learner and unassigned teacher cannot import or list drafts',async()=>{
  seed();
  assert.equal((await POST(request(payload,'bad'),context)).status,401);
  assert.equal((await POST(request(payload,'student'),context)).status,403);
  records.set('courses/course',{ownerId:'different'});
  assert.equal((await POST(request(payload,'teacher'),context)).status,403);
  const req=new Request('https://example.test/api/courses/course/lesson-imports',{headers:{Authorization:'Bearer student'}});
  assert.equal((await GET(req,context)).status,403);
});
test('role revocation blocks publication; forged content never creates drafts',async()=>{
  seed();
  assert.equal((await POST(request(payload,'teacher'),context)).status,200);
  records.set('users/teacher',{role:'student'});
  assert.equal((await POST(request({action:'publish',importId:id},'teacher'),context)).status,403);
  const bad={...payload,importId:'22222222-2222-4222-8222-222222222222',lessons:[{key:'l0',title:'Bad',nodes:[{tag:'script',children:[]}]}]};
  assert.equal((await POST(request(bad),context)).status,400);
  assert.equal(records.has('courses/course/lessonImports/'+bad.importId),false);
});
test('publication collision leaves every lesson and draft unchanged',async()=>{
  seed();await POST(request(payload),context);
  records.set('courses/course/lessons/'+id+'_l1',{title:'Unrelated record'});
  assert.equal((await POST(request({action:'publish',importId:id}),context)).status,500);
  assert.equal(records.has('courses/course/lessons/'+id+'_l0'),false);
  assert.equal(records.get('courses/course/lessonImports/'+id).status,'DRAFT');
  assert.equal(records.get('courses/course/lessons/'+id+'_l1').title,'Unrelated record');
});

