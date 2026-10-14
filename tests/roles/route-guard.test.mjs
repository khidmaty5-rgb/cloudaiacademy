import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
function load(path,mocks={}){
  const code=ts.transpileModule(readFileSync(new URL('../../'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const module={exports:{}};new Function('require','module','exports',code)(name=>mocks[name]??require(name),module,module.exports);return module.exports;
}
const policy=load('src/lib/route-access.ts');
function render(path,role,user={uid:'test'},loading=false){
  const Guard=load('src/components/auth/route-guard.tsx',{
    'lucide-react':{LoaderCircle:()=>React.createElement('span')},
    '@/lib/route-access':policy,'next/navigation':{usePathname:()=>path,useRouter:()=>({replace(){}})},
    '@/firebase':{useUser:()=>({user,isUserLoading:false})},'@/hooks/useCurrentRole':{useCurrentRole:()=>({role,loading})},
    '@/components/i18n/lang':{useLang:()=>({lang:'en'})},
  }).default;
  return renderToStaticMarkup(React.createElement(Guard,null,React.createElement('b',null,'PRIVATE CONTENT')));
}
test('unknown protected routes and unresolved roles never render protected children',()=>{
  for(const role of policy.allAuthenticatedRoles) {
    for(const path of ['/admin/unregistered','/teacher/unregistered','/reviewer/unregistered','/dashboard/unregistered']) assert.ok(!render(path,role).includes('PRIVATE CONTENT'));
  }
  assert.ok(!render('/admin/users','admin',null).includes('PRIVATE CONTENT'));
  assert.ok(!render('/admin/users','admin',{uid:'test'},true).includes('PRIVATE CONTENT'));
});
test('registered admin page and intentionally public staff login retain correct access',()=>{
  for(const role of policy.allAuthenticatedRoles)assert.equal(render('/admin/users',role).includes('PRIVATE CONTENT'),role==='admin');
  assert.ok(render('/admin','student',null).includes('PRIVATE CONTENT'));
});
