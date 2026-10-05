import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {zipSync,strToU8} from 'fflate';
const url = text => 'data:text/javascript;base64,'+Buffer.from(text).toString('base64');
async function compile(path, replacements={}) {
  let source=ts.transpileModule(await readFile(new URL('../../'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  for(const [from,to] of Object.entries(replacements))source=source.replaceAll(from,to);
  return url(source);
}
const packageUrl=await compile('src/lib/lesson-package.ts');
const parserUrl=await compile('src/lib/parse-lesson-zip.ts',{'./lesson-package':packageUrl,'fflate':import.meta.resolve('fflate'),'htmlparser2':import.meta.resolve('htmlparser2')});
const {parseLessonZip}=await import(parserUrl);
const {validatePackage}=await import(packageUrl);
const {canManageLessonImport}=await import(await compile('src/server/lesson-import-policy.ts'));
const zip=files=>zipSync(Object.fromEntries(Object.entries(files).map(([k,v])=>[k,typeof v==='string'?strToU8(v):v])));
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jC04AAAAASUVORK5CYII=','base64');
test('TOC order, Arabic titles, relative images and lesson links survive as inert structured content',()=>{
  const result=parseLessonZip(zip({
    'Table of Contents.html':'<a href="lessons/b.html">1. الدرس الثاني</a><a href="lessons/a.html">2. First</a>',
    'lessons/a.html':'<h1>First</h1><p>Hello <strong>world</strong></p>',
    'lessons/b.html':'<main><h1>العنوان</h1><img src="../images/pic.png" onerror="evil()"><a href="a.html">Next</a><script>evil()</script><iframe src="https://evil.invalid"></iframe><a href="javascript:evil()">Bad</a></main>',
    'images/pic.png':png
  }));
  assert.deepEqual(result.lessons.map(l=>l.title),['الدرس الثاني','First']);
  const serialized=JSON.stringify(result.lessons);
  assert.ok(serialized.includes('data:image/png;base64,'));
  assert.ok(serialized.includes('"target":"l1"'));
  assert.ok(!serialized.includes('evil'));
  assert.ok(!serialized.includes('onerror'));
});
test('rejects traversal and prototype paths before extraction',()=>{
  for(const name of ['../lesson.html','/lesson.html','C:/lesson.html','__proto__/lesson.html','a/../lesson.html'])
    assert.throws(()=>parseLessonZip(zip({[name]:'<p>Unsafe</p>'})),/UNSAFE_ARCHIVE_PATH/);
});
test('rejects duplicate normalized paths, overlong HTML and expansion bombs',()=>{
  assert.throws(()=>parseLessonZip(zip({'a.html':'<p>A</p>','A.html':'<p>B</p>'})),/DUPLICATE_PATH/);
  assert.throws(()=>parseLessonZip(zip({'a.html':'x'.repeat(300000)})),/ARCHIVE_LIMIT|HTML_TOO_LARGE/);
});
test('server validation rejects forged executable tags, URLs, SVG images and broken internal links',()=>{
  const check=node=>validatePackage({lessons:[{key:'l0',title:'Lesson',nodes:[node]}]});
  for(const node of [{tag:'script',children:[]},{tag:'a',href:'javascript:alert(1)',children:[]},{tag:'img',src:'data:image/svg+xml;base64,PHN2Zz4=',children:[]},{tag:'a',target:'l99',children:[]}])assert.throws(()=>check(node));
  const clean=check({tag:'p',children:[{text:'Hello'}],onClick:'evil()',style:'bad'});
  assert.equal(JSON.stringify(clean).includes('evil'),false);
});
test('only admins and assigned teachers can import or publish',()=>{
  for(const role of ['student','reviewer','editor',null])assert.equal(canManageLessonImport(role,'owner',{ownerId:'owner'}),false);
  assert.equal(canManageLessonImport('teacher','other',{ownerId:'owner'}),false);
  assert.equal(canManageLessonImport('teacher','owner',{ownerId:'owner'}),true);
  assert.equal(canManageLessonImport('teacher','teacher',{instructorIds:['teacher']}),true);
  assert.equal(canManageLessonImport('admin','admin',{}),true);
});
test('oversized images are reported without allocating their decompressed contents',()=>{
  const large=new Uint8Array(450000);
  const result=parseLessonZip(zipSync({'lesson.html':strToU8('<p>Hello</p><img src="large.png">'),'large.png':large},{level:0}));
  assert.ok(result.warnings.includes('LARGE_IMAGES_SKIPPED'));
  assert.ok(result.warnings.includes('MISSING_IMAGES'));
});
if(process.env.LESSON_ZIP_SAMPLE)test('user-supplied sample becomes exactly five ordered lessons',async()=>{
  const result=parseLessonZip(new Uint8Array(await readFile(process.env.LESSON_ZIP_SAMPLE)));
  assert.deepEqual(result.lessons.map(l=>l.title),['Introduction','Overview of Web Development','Understanding how Web Development Works','Web Application Architecture Overview','Summary']);
  assert.ok(JSON.stringify(result.lessons).includes('data:image/png;base64,'));
  console.log('Sample results:',result.lessons.map(l=>({title:l.title,bytes:Buffer.byteLength(JSON.stringify(l))})),result.warnings);
});

