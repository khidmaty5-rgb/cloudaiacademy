import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const files={};
for(const file of ['user-roles','index']) files[file]=ts.transpileModule(await readFile(new URL('../../functions/src/'+file+'.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function run(code,mocks){const module={exports:{}};new Function('require','module','exports',code)(name=>mocks[name],module,module.exports);return module.exports;}
const definitions=run(files['user-roles'],{});
function fixture(profile,failRead=false,failAuthReads=0){
  const calls=[];
  class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
  const auth={getUser:async()=>{if(failAuthReads-- >0)throw Error('transient');return {customClaims:{otherClaim:true}};},createUser:async data=>{calls.push(['create',data]);return {uid:'created',email:data.email};},setCustomUserClaims:async(...data)=>calls.push(['claims',...data])};
  const firestore=()=>({doc:path=>({get:async()=>{assert.match(path,/^users\//);if(failRead)throw Error('read unavailable');return {exists:profile!==undefined,data:()=>profile};},set:async data=>calls.push(['profile',path,data])})});
  firestore.FieldValue={serverTimestamp:()=>123};
  const functions={https:{onCall:fn=>fn,HttpsError},firestore:{document:()=>({onCreate:fn=>fn,onUpdate:fn=>fn})}};
  functions.runWith=()=>functions;
  const api=run(files.index,{'./user-roles':definitions,'firebase-admin':{initializeApp(){},firestore,auth:()=>auth},'firebase-functions':functions});
  return {api,calls};
}
const data={email:'test@example.org',password:'test-password',fullName:'Test Person',role:'teacher'};
test('callable denies every non-admin current profile despite an old admin token',async()=>{
  for(const role of ['student','teacher','reviewer','editor','invalid',undefined]){
    const f=fixture({role});
    await assert.rejects(f.api.adminCreateUser(data,{auth:{uid:'caller',token:{role:'admin'}}}),{code:'permission-denied'});
    assert.equal(f.calls.length,0);
  }
});
test('callable fails closed on missing profile/read error and unauthenticated caller',async()=>{
  for(const f of [fixture(undefined),fixture({role:'admin'},true)]){
    await assert.rejects(f.api.adminCreateUser(data,{auth:{uid:'caller',token:{role:'admin'}}}),{code:'permission-denied'});
    assert.equal(f.calls.length,0);
  }
  await assert.rejects(fixture({role:'admin'}).api.adminCreateUser(data,{}),{code:'unauthenticated'});
});
test('current admin succeeds despite stale lower claim; invalid roles/types never create users',async()=>{
  const f=fixture({role:'admin'});
  assert.deepEqual(await f.api.adminCreateUser(data,{auth:{uid:'caller',token:{role:'student'}}}),{uid:'created'});
  assert.equal(f.calls[1][2].role,'teacher');
  for(const patch of [{role:'superadmin'},{role:null},{role:''},{role:[]},{email:{}},{fullName:'  '}]){
    const rejected=fixture({role:'admin'});
    await assert.rejects(rejected.api.adminCreateUser({...data,...patch},{auth:{uid:'caller',token:{role:'admin'}}}),{code:'invalid-argument'});
    assert.equal(rejected.calls.length,0);
  }
});
test('claim-sync triggers never publish invalid role values',async()=>{
  const f=fixture({role:'admin'});
  await f.api.onUserCreate({data:()=>({role:'invalid'})},{params:{userId:'created'}});
  await f.api.onUserUpdate({before:{data:()=>({role:'student'})},after:{data:()=>({role:'invalid'})}},{params:{userId:'created'}});
  assert.equal(f.calls.length,0);
  assert.deepEqual(definitions.USER_ROLES,['student','teacher','reviewer','editor','admin']);
});

test('Spark workflow does not export a paid audit retry worker', () => {
  assert.equal(fixture({role:'admin'}).api.onRoleChangeAuditCreate, undefined);
});
