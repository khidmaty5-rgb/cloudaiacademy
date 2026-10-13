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
const definitions=load('functions/src/user-roles.ts');
const effective=load('src/server/effective-user-role.ts',{'@/lib/user-roles':definitions});
const box=({children})=>React.createElement('div',null,children);
test('Telegram page permits only teachers/admins in both languages',()=>{
  for(const role of definitions.USER_ROLES)for(const lang of ['en','ar']){
    const Component=load('src/components/teacher/telegram-workspace.tsx',{
      '@/firebase':{useUser:()=>({user:{uid:'test'},isUserLoading:false}),useDoc:()=>({data:{},isLoading:false}),useMemoFirebase:fn=>fn()},
      'firebase/firestore':{getFirestore:()=>({}),doc:()=>({})},'firebase/auth':{getAuth:()=>({})},
      '@/hooks/useCurrentRole':{useCurrentRole:()=>({isAdmin:role==='admin',isTeacher:role==='teacher',loading:false})},
      '@/components/i18n/lang':{useLang:()=>({lang})},'@/hooks/use-toast':{useToast:()=>({toast(){}})},
      '@/components/ui/button':{Button:box},'@/components/ui/card':{Card:box,CardContent:box,CardHeader:box,CardTitle:box},
      '@/components/ui/textarea':{Textarea:box},'@/components/ui/input':{Input:box},'@/components/ui/skeleton':{Skeleton:box},
    }).default;
    const html=renderToStaticMarkup(React.createElement(Component));
    assert.equal(html.includes('<h1'),role==='admin'||role==='teacher');
  }
});
test('Telegram jobs API trusts current profile, rejects learners/editors and stale admin claims',async()=>{
  for(const role of [...definitions.USER_ROLES,'invalid']){
    const query={where(){return this;},orderBy(){return this;},limit(){return this;},async get(){return {docs:[]};}};
    const db={doc:()=>({get:async()=>({exists:true,data:()=>({role})})}),collection:()=>query};
    const {GET}=load('src/app/api/telegram/jobs/list/route.ts',{
      'firebase-admin/app':{getApps:()=>[{name:'adminAppTelegramJobsList'}]},
      'firebase-admin/auth':{getAuth:()=>({verifyIdToken:async()=>({uid:'test',role:'admin'})})},
      'firebase-admin/firestore':{getFirestore:()=>db},'@/firebase/config':{firebaseConfig:{}},'@/server/effective-user-role':effective,
    });
    assert.equal((await GET(new Request('http://test/api',{headers:{authorization:'Bearer test'}}))).status,role==='teacher'||role==='admin'?200:403);
    assert.equal((await GET(new Request('http://test/api'))).status,401);
  }
});
test('legacy entry redirects and provider endpoints retain their authorization boundary',()=>{
  let destination;
  const legacy=load('src/app/dashboard/telegram/page.tsx',{'next/navigation':{redirect:path=>{destination=path;}}});
  legacy.default();assert.equal(destination,'/teacher/telegram');
  for(const path of ['connect/start','jobs/create','jobs/list','jobs/cancel']){
    const source=readFileSync(new URL('../../src/app/api/telegram/'+path+'/route.ts',import.meta.url),'utf8');
    assert.match(source,/getAuthorizedUserRole\(db, uid, decoded\?\.role, \['admin', 'teacher'\]\)/);
  }
});
