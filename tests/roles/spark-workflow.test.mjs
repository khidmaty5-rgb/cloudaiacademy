import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import ts from 'typescript';
const require = createRequire(import.meta.url);
async function load(path, mocks) {
  const source = await readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => mocks[name] ?? require(name), module, module.exports);
  return module.exports;
}
test('account creation uses Next directly and profile edits never reassert roles', async () => {
  const writes = [], calls = [];
  const user = { getIdToken: async () => 'fixture-token' };
  const api = await load('src/lib/user.ts', {
    'firebase/auth': { updateProfile: async () => {} },
    'firebase/firestore': { doc: () => ({}), updateDoc: async (ref, data) => writes.push(data) },
    '@/firebase': { initializeFirebase: () => ({ auth: { currentUser: user }, firestore: {} }) },
  });
  const previous = globalThis.fetch;
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return { ok: true }; };
  try {
    await api.createUserWithRole('fixture@example.invalid', 'test-password', 'Test Person', 'teacher');
    assert.equal(calls.length, 1); assert.equal(calls[0].url, '/api/admin/create-user');
    assert.equal(JSON.parse(calls[0].options.body).role, 'teacher');
    await api.updateUserProfile(user, { firstName: 'Test', lastName: 'Person' });
    assert.deepEqual(writes, [{ firstName: 'Test', lastName: 'Person' }]);
  } finally { globalThis.fetch = previous; }
});
test('active client workflows contain no Functions SDK dependency', async () => {
  for (const path of ['src/lib/user.ts', 'src/firebase/client-provider.tsx']) {
    const source = await readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /firebase\/functions|httpsCallable|getFunctions/);
  }
});
test('recovery API denies stale admin claims, missing auth, malformed IDs and service failures', async () => {
  const canonical = await load('functions/src/user-roles.ts', {});
  const recovery = await load('src/server/role-claim-recovery.ts', { '@/lib/user-roles': canonical });
  let profile = 'student', failRead = false, recoveries = 0;
  const db = { doc: () => ({ get: async () => { if (failRead) throw Error('unavailable'); return { data: () => ({ role: profile }) }; } }) };
  const api = await load('src/app/api/admin/role-sync/route.ts', {
    '@/server/firebase-admin': { getFirebaseAdminAuth: () => ({ verifyIdToken: async () => ({ uid: 'actor', role: 'admin' }) }), getFirebaseAdminFirestore: () => db },
    '@/server/role-claim-recovery': { ...recovery, recoverRoleClaims: async () => { recoveries++; return { role: 'student' }; } },
  });
  const request = (body, authorized = true) => new Request('http://test/api', { method: 'POST', headers: authorized ? { authorization: 'Bearer fixture', 'Content-Type': 'application/json' } : {}, body: JSON.stringify(body) });
  assert.equal((await api.POST(request({}, false))).status, 401);
  assert.equal((await api.POST(request({ auditId: 'request-000000001' }))).status, 403);
  failRead = true; assert.equal((await api.POST(request({}))).status, 503); failRead = false;
  profile = 'admin';
  for (const auditId of ['../escape', '', null, 'x'.repeat(81)]) assert.equal((await api.POST(request({ auditId }))).status, 400);
  assert.equal(recoveries, 0);
  assert.equal((await api.POST(request({ auditId: 'request-000000001', role: 'admin' }))).status, 200);
  assert.equal(recoveries, 1);
});
