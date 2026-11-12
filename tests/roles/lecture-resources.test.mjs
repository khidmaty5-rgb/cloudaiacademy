import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { PDFDocument, PDFName } from 'pdf-lib';
const url = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
async function compile(path, replacements = {}) {
  let source = ts.transpileModule(await readFile(new URL('../../' + path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const [a,b] of Object.entries(replacements)) source = source.replaceAll(a,b);
  return url(source);
}
const fake = url(`
export const records = new Map(); export const objects = new Map();
export const courseState = { published: true, removed: false };
export async function openCourseRecord() { if (courseState.removed) throw Error('NOT_FOUND'); return { published: courseState.published }; }
const snap = path => ({id:path.split('/').at(-1),exists:records.has(path),data:()=>records.get(path)});
const ref = path => ({path,get:async()=>snap(path),set:async data=>records.set(path,data),delete:async()=>records.delete(path),create:async data=>records.set(path,data)});
const query = (prefix, published=false, after='', count=25) => ({
 where:()=>query(prefix,true,after,count),orderBy:()=>query(prefix,published,after,count),limit:n=>query(prefix,published,after,n),startAfter:id=>query(prefix,published,id,count),
 get:async()=>{const docs=[...records.keys()].filter(k=>k.startsWith(prefix+'/')).map(snap).filter(s=>!published||s.data().published===true).filter(s=>s.id>after).sort((a,b)=>a.id.localeCompare(b.id)).slice(0,count);return {docs,size:docs.length};}
});
export const getFirebaseAdminFirestore = () => ({doc:ref,collection:query,runTransaction:fn=>fn({get:r=>r.get(),update:(r,d)=>records.set(r.path,{...records.get(r.path),...d}),delete:r=>records.delete(r.path)})});
export const getFirebaseAdminAuth=()=>({getUserByEmail:async email=>({uid:email.split('@')[0]}),verifyIdToken:async(token,revoked)=>{if(!revoked||!['admin','student','teacher','stale'].includes(token)) throw Error('invalid'); return {uid:token,role:'admin'};}});
export const FieldPath={documentId:()=> '__name__'};
export class PutObjectCommand {constructor(input){this.input=input;this.kind='put';}}
export class DeleteObjectCommand {constructor(input){this.input=input;this.kind='delete';}}
export class GetObjectCommand {constructor(input){this.input=input;this.kind='get';}}
export class GetBucketAclCommand {constructor(input){this.input=input;this.kind='acl';}}
export class GetBucketPolicyCommand {constructor(input){this.input=input;this.kind='policy';}}
export const privacy={mode:'private'};
export const getS3Client=()=>({send:async command=>{const {Key,Body}=command.input;
if(command.kind==='acl'){if(privacy.mode==='denied')throw Error('denied');return {Grants:privacy.mode==='public-acl'?[{Grantee:{URI:'http://acs.amazonaws.com/groups/global/AllUsers'}}]:[]};}
if(command.kind==='policy'){if(privacy.mode==='public-policy')return {Policy:JSON.stringify({Statement:[{Effect:'Allow',Principal:'*'}]})};const e=Error('none');e.name='NoSuchBucketPolicy';throw e;}
if(command.kind==='put') objects.set(Key,Body); if(command.kind==='delete') objects.delete(Key); return {Body:{transformToWebStream:()=>new Blob([objects.get(Key)]).stream()}};}});
`);
const lib = await compile('src/lib/lecture-resources.ts');
const server = await compile('src/server/lecture-resources.ts', { 'server-only':url(''), 'pdf-lib':import.meta.resolve('pdf-lib'), '@/server/firebase-admin':fake, '@/lib/lecture-resources':lib, '@aws-sdk/client-s3':fake, '@/lib/s3':fake });
const replacements = { '@/server/firebase-admin':fake, '@/server/lecture-resources':server, '@/lib/lecture-resources':lib, '@/lib/s3':fake, '@aws-sdk/client-s3':fake, 'firebase-admin/firestore':fake };
replacements['@/server/course-assignment-resources'] = await compile('src/server/course-assignment-resources.ts', { ...replacements, 'server-only': url(''), '@/server/open-courses': fake, '@/lib/course-price':await compile('src/lib/course-price.ts'), '@/lib/roles':await compile('src/lib/roles.ts',{'@/lib/user-roles':await compile('functions/src/user-roles.ts')}) });
const staffApi=await import(await compile('src/app/api/assignment-instructors/route.ts',{...replacements,'@/server/open-courses':fake,'@/lib/open-course-management':url("export const validOpenCourseId=id=>id==='number-systems'")}));
const api = await import(await compile('src/app/api/lecture-resources/route.ts', replacements));
const download = await import(await compile('src/app/api/lecture-resources/[id]/download/route.ts', replacements));
const { records, objects, privacy, courseState } = await import(fake);
const { validateLecturePdf, readBoundedBody } = await import(server);
const base = 'https://academy.test/api/lecture-resources';
process.env.S3_BUCKET_LESSONS = 'test-only-bucket';
function seed(){ records.clear(); objects.clear(); records.set('users/admin',{role:'admin'}); records.set('users/student',{role:'student'}); records.set('users/teacher',{role:'teacher'}); records.set('users/stale',{role:'student'}); }
const auth = token => token ? { Authorization:'Bearer '+token } : {};
async function pdf(){const doc=await PDFDocument.create();doc.addPage();return doc.save();}
async function upload(token='admin', bytes){ const data=new FormData();data.set('title','Lecture 1');data.set('topic','Networking');data.set('file',new Blob([bytes||await pdf()],{type:'application/pdf'}),'sheet.pdf');return api.POST(new Request(base,{method:'POST',headers:auth(token),body:data})); }
const patch = (id,published,token='admin') => api.PATCH(new Request(base,{method:'PATCH',headers:auth(token),body:JSON.stringify({id,published})}));
const getDownload=id=>download.GET(new Request(base),{params:Promise.resolve({id})});

test('PDF draft stays private; explicit publish enables anonymous download; withdrawal blocks it', async()=>{
 seed(); const saved=await upload();assert.equal(saved.status,201); const {id}=await saved.json();
 assert.equal((await (await api.GET(new Request(base))).json()).items.length,0);
 assert.equal((await getDownload(id)).status,404);
 assert.equal((await patch(id,true)).status,200);
 const list=await (await api.GET(new Request(base))).json();assert.equal(list.items.length,1);assert.equal(list.items[0].createdBy,undefined);assert.equal(list.items[0].key,undefined);
 const response=await getDownload(id);assert.equal(response.status,200);assert.match(response.headers.get('content-disposition'),/^attachment/);assert.match(response.headers.get('content-security-policy'),/sandbox/);assert.ok((await response.arrayBuffer()).byteLength>0);
 assert.equal((await patch(id,false)).status,200);assert.equal((await getDownload(id)).status,404);
});
test('anonymous, learner, teacher and stale privileged claims cannot manage resources',async()=>{
 seed();for(const token of [null,'student','teacher','stale','invalid']) {
  const expected=!token||token==='invalid'?401:403;
  assert.equal((await upload(token)).status,expected);
  assert.equal((await api.GET(new Request(base+'?manage=1',{headers:auth(token)}))).status,expected);
  assert.equal((await patch('11111111-1111-4111-8111-111111111111',true,token)).status,expected);
 } assert.equal(objects.size,0);
});
test('invalid PDFs and malformed paths are rejected without storage writes',async()=>{
 seed();assert.equal((await upload('admin',Buffer.from('<script>bad</script>'))).status,400);assert.equal(objects.size,0);
 assert.equal((await getDownload('../certificates/private')).status,404);
 assert.equal((await api.GET(new Request(base+'?after=bad'))).status,400);
});
test('bounded reader and PDF checks reject oversize, embedded script and nested actions',async()=>{
 await assert.rejects(readBoundedBody(new Request(base,{method:'POST',body:'12345'}),4),/FILE_TOO_LARGE/);
 await assert.rejects(validateLecturePdf(new Uint8Array(3*1024*1024+1)),/FILE_TOO_LARGE/);
 for(const kind of ['OpenAction','Nested']) {
  const doc=await PDFDocument.create();doc.addPage();
  if(kind==='OpenAction') doc.catalog.set(PDFName.of('OpenAction'),doc.context.obj({S:'JavaScript',JS:'bad'}));
  else doc.catalog.set(PDFName.of('Custom'),doc.context.obj({Nested:{S:'JavaScript'}}));
  await assert.rejects(validateLecturePdf(await doc.save()),/INVALID_PDF/);
 }
});
test('public or unverifiable storage fails closed before uploading any file',async()=>{
 for(const mode of ['public-acl','public-policy','denied']) {
  seed();privacy.mode=mode;const response=await upload();assert.equal(response.status,503);
  assert.equal((await response.json()).error,'STORAGE_PRIVACY_UNVERIFIED');assert.equal(objects.size,0);
 } privacy.mode='private';
});

test('confirmed deletion is admin-only, retryable and isolated from student work',async()=>{
 seed(); const {id}=await (await upload()).json(); await patch(id,true);
 records.set('studentInbox/keep',{message:'student answer'});
 const remove=(role='admin',confirmation='DELETE '+id,scope='')=>api.DELETE(new Request(base+scope,{method:'DELETE',headers:auth(role),body:JSON.stringify({id,confirmation})}));
 for(const role of [null,'student','teacher']) assert.ok([401,403].includes((await remove(role)).status));
 assert.equal((await remove('admin','wrong')).status,400);
 assert.equal((await remove('admin','DELETE '+id,'?courseId=number-systems')).status,200);
 assert.equal(objects.size,1); assert.ok(records.has('lectureResources/'+id));
 privacy.mode='denied'; assert.equal((await remove()).status,503);
 assert.equal((await getDownload(id)).status,404);
 assert.equal((await patch(id,true)).status,404);
 privacy.mode='private'; assert.equal((await remove()).status,200);
 assert.equal(objects.size,0); assert.equal(records.has('lectureResources/'+id),false);
 assert.equal((await remove()).status,200);
 assert.deepEqual(records.get('studentInbox/keep'),{message:'student answer'});
});

test('course assignment PDFs are private drafts, isolated from general resources and withdrawn with course', async () => {
 seed(); courseState.published = true; courseState.removed = false;
 const scoped = base + '?courseId=number-systems';
 const data = new FormData(); data.set('title','Assignment 1'); data.set('file',new Blob([await pdf()],{type:'application/pdf'}),'assignment.pdf');
 const result = await api.POST(new Request(scoped,{method:'POST',headers:auth('admin'),body:data}));
 assert.equal(result.status,201); const {id} = await result.json();
 const downloadRequest = () => download.GET(new Request(scoped),{params:Promise.resolve({id})});
 assert.equal((await downloadRequest()).status,404);
 assert.equal((await (await api.GET(new Request(base+'?manage=1',{headers:auth('admin')}))).json()).items.length,0);
 assert.equal((await api.PATCH(new Request(scoped,{method:'PATCH',headers:auth('admin'),body:JSON.stringify({id,published:true})}))).status,200);
 assert.equal((await (await api.GET(new Request(scoped))).json()).items.length,1);
 assert.equal((await downloadRequest()).status,200);
 assert.equal((await getDownload(id)).status,404);
 courseState.published = false;
 assert.equal((await api.GET(new Request(scoped))).status,404);
 assert.equal((await downloadRequest()).status,404);
 assert.equal((await api.GET(new Request(scoped+'&manage=1',{headers:auth('admin')}))).status,200);
 courseState.removed = true;
 assert.equal((await api.GET(new Request(scoped+'&manage=1',{headers:auth('admin')}))).status,404);
 courseState.removed = false; courseState.published = true;
 assert.equal((await api.GET(new Request(base+'?courseId=../private'))).status,404);
});

test('regular course assignments enforce ownership, enrollment and paid access on every download',async()=>{
 seed();const u=base+'?kind=regular&courseId=demo';records.set('courses/demo',{status:'PUBLISHED',instructorIds:['teacher'],price:20});
 const data=new FormData();data.set('title','Exercise');data.set('file',new Blob([await pdf()],{type:'application/pdf'}),'instructions.pdf');
 const saved=await api.POST(new Request(u,{method:'POST',headers:auth('teacher'),body:data}));assert.equal(saved.status,201);
 const {id}=await saved.json();const file=t=>download.GET(new Request(u,{headers:auth(t)}),{params:Promise.resolve({id})});
 const publish=()=>api.PATCH(new Request(u,{method:'PATCH',headers:auth('teacher'),body:JSON.stringify({id,published:true})}));
 assert.equal((await publish()).status,200);assert.equal((await file(null)).status,401);assert.equal((await file('student')).status,403);
 records.set('users/student/enrollments/demo',{});assert.equal((await file('student')).status,200);
 records.set('settings/payment',{paywall:{enabled:true,defaultRequirePayment:true}});assert.equal((await file('student')).status,403);
 records.set('users/student/coursePurchases/demo',{});assert.equal((await file('student')).status,200);
 const remove=t=>api.DELETE(new Request(u,{method:'DELETE',headers:auth(t),body:JSON.stringify({id,confirmation:'DELETE '+id})}));
 records.set('courses/demo',{status:'PUBLISHED',ownerId:'someone-else'});assert.equal((await remove('teacher')).status,403);
 records.set('courses/demo',{status:'PUBLISHED',ownerId:'teacher'});assert.equal((await remove('student')).status,403);assert.equal((await remove('teacher')).status,200);
 assert.equal((await file('admin')).status,404);
});
test('an open-course instructor grant is scoped and revocable',async()=>{
 seed();const list=id=>api.GET(new Request(base+'?manage=1&courseId='+id,{headers:auth('teacher')}));
 assert.equal((await list('number-systems')).status,403);records.set('openAssignmentStaff/number-systems',{teacherUid:'teacher'});
 assert.equal((await list('number-systems')).status,200);assert.equal((await list('11111111-1111-4111-8111-111111111111')).status,403);
 records.delete('openAssignmentStaff/number-systems');assert.equal((await list('number-systems')).status,403);
});
test('assignment edits keep PDF, visibility and student work intact and enforce course access',async()=>{
 seed();courseState.published=true;courseState.removed=false;
 const id='11111111-1111-4111-8111-111111111111', path='courseAssignmentResources/number-systems/items/'+id;
 records.set(path,{title:'Before',topic:'',description:'',published:false,key:'original.pdf'});
 records.set('studentInbox/keep',{message:'answer'});
 const edit=(token,extra={})=>api.PUT(new Request(base+'?courseId=number-systems',{method:'PUT',headers:auth(token),body:JSON.stringify({id,title:' Edited ',topic:'Topic',description:'تفاصيل الواجب',...extra})}));
 assert.equal((await edit(null)).status,401);assert.equal((await edit('teacher')).status,403);
 records.set('openAssignmentStaff/number-systems',{teacherUid:'teacher'});
 assert.equal((await edit('teacher',{published:true,key:'other.pdf'})).status,200);
 assert.equal(records.get(path).title,'Edited');assert.equal(records.get(path).published,false);assert.equal(records.get(path).key,'original.pdf');
 records.set(path,{...records.get(path),published:true});
 assert.equal((await edit('admin')).status,200);assert.equal(records.get(path).published,true);
 assert.equal((await edit('teacher',{title:' '})).status,400);
 records.set(path,{...records.get(path),deleting:true});assert.equal((await edit('teacher')).status,404);
 assert.deepEqual(records.get('studentInbox/keep'),{message:'answer'});
});

test('only administrators can grant or remove open course instructor access',async()=>{
 seed();const change=(actor,email)=>staffApi.PUT(new Request(base,{method:'PUT',headers:auth(actor),body:JSON.stringify({courseId:'number-systems',email})}));
 for(const actor of ['student','teacher']) assert.equal((await change(actor,'teacher@example.test')).status,403);
 assert.equal((await change('admin','student@example.test')).status,400);
 assert.equal((await change('admin','teacher@example.test')).status,200);assert.equal(records.get('openAssignmentStaff/number-systems').teacherUid,'teacher');
 assert.equal((await change('admin','')).status,200);assert.equal(records.has('openAssignmentStaff/number-systems'),false);
});
