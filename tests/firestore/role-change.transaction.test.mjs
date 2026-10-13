import assert from 'node:assert/strict';
import {test,beforeEach,after} from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {createRequire} from 'node:module';
const encode=source=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');
const definitions=encode(await readFile(new URL('../../functions/src/user-roles.ts',import.meta.url),'utf8'));
const roleService=await import(encode((await readFile(new URL('../../src/server/role-change.ts',import.meta.url),'utf8')).replaceAll('@/lib/user-roles',definitions).replaceAll('firebase-admin/firestore',import.meta.resolve('firebase-admin/firestore'))));
const {changeUserRole}=roleService;
if (!process.env.FIRESTORE_EMULATOR_HOST) throw Error('Emulator required; never run on a live project');
const app=initializeApp({projectId:'demo-cloudai-role-transactions'},'role-transaction-test');
const db=getFirestore(app);
beforeEach(async()=>{for(const collection of ['users','roleChangeAudit','securityState']){const snap=await db.collection(collection).get();const batch=db.batch();for(const doc of snap.docs)batch.delete(doc.ref);await batch.commit();}});
after(async()=>{await db.terminate();await deleteApp(app);});
const seed=async(uid,role)=>db.doc('users/'+uid).set({role});
test('profile change and audit commit together; retry is idempotent',async()=>{
  await seed('admin','admin');await seed('target','student');
  await changeUserRole(db,'admin','target','teacher','same-request-id-001','Assigned teaching');
  assert.equal((await db.doc('users/target').get()).data().role,'teacher');
  const event=(await db.doc('roleChangeAudit/same-request-id-001').get()).data();
  assert.equal(event.previousRole,'student');assert.equal(event.newRole,'teacher');assert.equal(event.actorUid,'admin');assert.equal(event.claimsSync,'pending');
  await changeUserRole(db,'admin','target','teacher','same-request-id-001');
  assert.equal((await db.collection('roleChangeAudit').get()).size,1);
  await assert.rejects(changeUserRole(db,'admin','target','editor','same-request-id-001'),{code:'REQUEST_ID_CONFLICT'});
});
test('self-demotion of the only administrator changes nothing',async()=>{
  await seed('only','admin');
  await assert.rejects(changeUserRole(db,'only','only','student','request-000000001'),{code:'SELF_ROLE_CHANGE_DENIED'});
  assert.equal((await db.doc('users/only').get()).data().role,'admin');
  assert.equal((await db.collection('roleChangeAudit').get()).size,0);
});
test('concurrent cross-demotions cannot eliminate all administrators',async()=>{
  await seed('a','admin');await seed('b','admin');
  const results=await Promise.allSettled([changeUserRole(db,'a','b','student','request-000000001'),changeUserRole(db,'b','a','student','request-000000002')]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await db.collection('users').where('role','==','admin').get()).size,1);
  assert.equal((await db.collection('roleChangeAudit').get()).size,1);
});
test('revoked admin and replay after a subsequent change cannot write or restore earlier privileges',async()=>{
  await seed('admin','student');await seed('target','student');
  await assert.rejects(changeUserRole(db,'admin','target','admin','request-000000001'),{code:'FORBIDDEN'});
  await seed('admin','admin');
  await changeUserRole(db,'admin','target','teacher','request-000000001');
  await changeUserRole(db,'admin','target','student','request-000000002');
  await assert.rejects(changeUserRole(db,'admin','target','teacher','request-000000001'),{code:'STALE_ROLE_CHANGE_REQUEST'});
  assert.equal((await db.doc('users/target').get()).data().role,'student');
});

test('actual role API retains committed audit/profile on claims failure and safely completes a retry',async()=>{
  await seed('admin','admin');await seed('target','student');
  const canonical=await import(definitions);
  const effective=await import(encode((await readFile(new URL('../../src/server/effective-user-role.ts',import.meta.url),'utf8')).replaceAll('@/lib/user-roles',definitions)));
  let attempts=0;const claims=[];
  const auth={verifyIdToken:async()=>({uid:'admin',role:'admin'}),getUser:async()=>({customClaims:{otherClaim:true}}),setCustomUserClaims:async(uid,value)=>{if(attempts++===0)throw Error('transient');claims.push(value);}};
  const mocks={'firebase-admin/app':{getApps:()=>[{name:'adminApp'}]},'firebase-admin/auth':{getAuth:()=>auth},'firebase-admin/firestore':{getFirestore:()=>db},'@/firebase/config':{firebaseConfig:{}},'@/server/effective-user-role':effective,'@/lib/user-roles':canonical,'@/server/role-change':roleService};
  const require=createRequire(import.meta.url);const module={exports:{}};
  const code=ts.transpileModule(await readFile(new URL('../../src/app/api/admin/update-user-role/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  new Function('require','module','exports',code)(name=>mocks[name]??require(name),module,module.exports);
  const request=()=>new Request('http://test/api',{method:'POST',headers:{authorization:'Bearer test','content-type':'application/json'},body:JSON.stringify({userId:'target',role:'teacher',requestId:'request-000000001'})});
  const first=await module.exports.POST(request());assert.equal(first.status,200);assert.equal((await first.json()).claimsSyncPending,true);
  assert.equal((await db.doc('users/target').get()).data().role,'teacher');
  assert.equal((await db.doc('roleChangeAudit/request-000000001').get()).data().claimsSync,'pending');
  const retry=await module.exports.POST(request());assert.equal(retry.status,200);assert.equal((await retry.json()).claimsSyncPending,false);
  assert.equal((await db.collection('roleChangeAudit').get()).size,1);
  assert.equal((await db.doc('roleChangeAudit/request-000000001').get()).data().claimsSync,'complete');
  assert.deepEqual(claims,[{otherClaim:true,role:'teacher'}]);
});
