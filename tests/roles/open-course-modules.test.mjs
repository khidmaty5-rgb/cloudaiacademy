import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const result = await build({ entryPoints: ['src/lib/open-course-modules.ts'], bundle:true, write:false, platform:'node', format:'cjs' });
const module = { exports:{} };
new Function('require','module','exports',result.outputFiles[0].text)(require,module,module.exports);
const { changeModule } = module.exports;
const lesson = (key='l0', title='First') => ({key,title,nodes:[],interactiveHtml:'<h1>'+title+'</h1>'});
const base = () => ({lessons:[lesson()],warnings:[]});
test('add, rename, replace, reorder, remove preserve unrelated lessons and original input',()=>{
  const original=base(), snapshot=JSON.stringify(original);
  let p=changeModule(original,{kind:'add',lesson:lesson('l0','Second')});
  assert.deepEqual(p.lessons.map(x=>x.key),['l0','l1']);
  p=changeModule(p,{kind:'rename',key:'l1',title:' Renamed '});
  assert.equal(p.lessons[1].title,'Renamed');
  p=changeModule(p,{kind:'replace',key:'l1',lesson:lesson('l0','New content')});
  assert.equal(p.lessons[1].key,'l1');
  assert.equal(p.lessons[0].interactiveHtml,original.lessons[0].interactiveHtml);
  p=changeModule(p,{kind:'move',key:'l1',direction:-1});
  assert.deepEqual(p.lessons.map(x=>x.key),['l1','l0']);
  p=changeModule(p,{kind:'remove',key:'l1'});
  assert.deepEqual(p.lessons,original.lessons);assert.equal(JSON.stringify(original),snapshot);
});
test('rejects last-module removal, blank titles, missing targets and noninteractive modules',()=>{
  for(const c of [{kind:'remove',key:'l0'},{kind:'rename',key:'l0',title:' '},{kind:'remove',key:'l9'},{kind:'move',key:'l0',direction:-1},{kind:'add',lesson:{key:'l3',title:'Unsafe',nodes:[{text:'text'}]}}])assert.throws(()=>changeModule(base(),c));
});
test('package count and content limits still apply',()=>{
  const p={lessons:Array.from({length:20},(_,i)=>lesson('l'+i)),warnings:[]};
  assert.throws(()=>changeModule(p,{kind:'add',lesson:lesson()}));
  assert.throws(()=>changeModule(base(),{kind:'replace',key:'l0',lesson:{...lesson(),interactiveHtml:'x'.repeat(650001)}}));
});
