import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {zipSync,strToU8} from 'fflate';
const url=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
async function compile(path,replacements={}) {
  let code=ts.transpileModule(await readFile(new URL('../../'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  for(const [from,to] of Object.entries(replacements))code=code.replaceAll(from,to);
  return url(code);
}
const pkg=await compile('src/lib/lesson-package.ts');
const {suggestCourseDetails,courseManifest}=await import(await compile('src/lib/course-package-details.ts',{'./lesson-package':pkg,fflate:import.meta.resolve('fflate'),htmlparser2:import.meta.resolve('htmlparser2')}));
test('course details come from headings and lead text, with editable suggestions and no invented price',()=>{
  const result=suggestCourseDetails({lessons:[{key:'l0',title:'Document title',nodes:[],interactiveHtml:'<h1>Tailscale: Fundamentals<br>to Secure Cloud Access</h1><p class="lead">Learn WireGuard and networking through practical labs.</p><script>secret()</script>'}]},'index.html');
  assert.equal(result.title,'Tailscale: Fundamentals to Secure Cloud Access');
  assert.equal(result.description,'Learn WireGuard and networking through practical labs.');
  assert.equal(result.courseCode,'TAILSCALE');assert.equal(result.category,'Networking');
  assert.equal(result.price,undefined);assert.equal(result.totalHours,undefined);assert.equal(result.duration,'Self-paced');
});
test('explicit manifest metadata takes priority and cannot set roles or publication state',()=>{
  const result=suggestCourseDetails({lessons:[{key:'l0',title:'Lesson',nodes:[{text:'Lesson content'}]}]},'Course.zip',{
    title:'Custom course',description:'A reviewed description',courseCode:'AWS101',category:'Cloud',level:'Advanced',totalHours:24,duration:'6 weeks',price:'199',ownerId:'attacker',status:'PUBLISHED',imageUrl:'javascript:alert(1)',
  });
  assert.equal(result.title,'Custom course');assert.equal(result.level,'Advanced');assert.equal(result.totalHours,24);assert.equal(result.price,'199');
  assert.equal(result.ownerId,undefined);assert.equal(result.status,undefined);assert.equal(result.imageUrl,undefined);
});
test('bounded metadata manifest supports ZIP packages and rejects ambiguous input',()=>{
  const zip=files=>zipSync(Object.fromEntries(Object.entries(files).map(([key,value])=>[key,strToU8(value)])));
  assert.deepEqual(courseManifest(zip({'course.json':'{"title":"Example"}'})),{title:'Example'});
  assert.throws(()=>courseManifest(zip({'course.json':'[1,2]'})),/COURSE_METADATA_INVALID/);
  assert.throws(()=>courseManifest(zip({'course.json':'{}','nested/course.json':'{}'})),/COURSE_METADATA_INVALID/);
});
const stub=url(`export const records=new Map();let next=0;export const collection=(_,name)=>({path:name});export const doc=(parent,...parts)=>{const path=parts.length?parts.join('/'):parent.path+'/auto-'+(++next);return {path,id:path.split('/').at(-1)}};export const serverTimestamp=()=>1;export const updateDoc=async()=>{};export const runTransaction=async(_,fn)=>fn({get:async ref=>({exists:()=>records.has(ref.path)}),set:(ref,data)=>records.set(ref.path,data)});export const getAuth=()=>({currentUser:{uid:'admin'}});`);
const {addCourse}=await import(await compile('src/lib/courses.ts',{'firebase/firestore':stub,'firebase/auth':stub,'@/firebase':url('export const initializeFirebase=()=>({firestore:{}})')}));
const {records}=await import(stub);
test('creating a duplicate uploaded course cannot overwrite an existing course',async()=>{
  records.clear();records.set('courses/tailscale',{title:'Existing',description:'Preserve this'});
  await assert.rejects(addCourse({title:'Tailscale',description:'New package',category:'Networking',price:'199',duration:'Self-paced',level:'Beginner'}),/already exists/);
  assert.equal(records.get('courses/tailscale').description,'Preserve this');
  const result=await addCourse({title:'دورة عربية',description:'محتوى الدورة',category:'Cloud',price:'Free',duration:'Self-paced',level:'Beginner'});
  assert.match(result.id,/^course-auto-/);assert.equal(records.get('courses/'+result.id).status,'DRAFT');
});
