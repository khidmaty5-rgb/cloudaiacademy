import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import ts from 'typescript';
const require = createRequire(import.meta.url);
async function load(path, mocks = {}) { const code = ts.transpileModule(await readFile(new URL('../../' + path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText; const module = { exports: {} }; new Function('require', 'module', 'exports', code)(name => mocks[name] ?? require(name), module, module.exports); return module.exports; }
const records = new Map(), objects = new Map(); let failStorage = false, failFinal = false, published = true, privateBucket = true;
const snapshot = path => ({ id: path.split('/').at(-1), exists: records.has(path), data: () => records.get(path) });
const ref = path => ({ path, get: async () => snapshot(path), update: async data => { if (failFinal) throw Error('fail'); records.set(path, { ...records.get(path), ...data }); } });
const query = (prefix, after = '', limit = 30) => ({ orderBy: () => query(prefix, after, limit), limit: n => query(prefix, after, n), startAfter: id => query(prefix, id, limit), get: async () => { const docs = [...records.keys()].filter(k => k.startsWith(prefix + '/') && k.split('/').at(-1) > after).sort().slice(0, limit).map(snapshot); return { docs, size: docs.length }; } });
const db = { doc: ref, collection: query, runTransaction: async fn => { const writes = []; const result = await fn({ get: r => r.get(), create: (r, v) => writes.push(() => { assert.equal(records.has(r.path), false); records.set(r.path, v); }), set: (r, v) => writes.push(() => records.set(r.path, v)), update: (r, v) => writes.push(() => records.set(r.path, { ...records.get(r.path), ...v })) }); writes.forEach(f => f()); return result; } };
const aws = Object.fromEntries(['PutObject', 'GetObject', 'GetBucketAcl', 'GetBucketPolicy'].map(kind => [kind + 'Command', class { constructor(input) { this.kind = kind; this.input = input; } }]));
const s3 = { getS3Client: () => ({ send: async command => { if (command.kind === 'GetBucketAcl') return { Grants: privateBucket ? [] : [{ Grantee: { URI: 'AllUsers' } }] }; if (command.kind === 'GetBucketPolicy') { const e = Error(); e.name = 'NoSuchBucketPolicy'; throw e; } const { Key, Body } = command.input; if (command.kind === 'PutObject') { if (failStorage) throw Error(); objects.set(Key, Body); return {}; } const bytes = objects.get(Key); return { ContentLength: bytes.length, Body: { transformToWebStream: () => new Blob([bytes]).stream() } }; } }) };
const firebase = { getFirebaseAdminFirestore: () => db, getFirebaseAdminAuth: () => ({ verifyIdToken: async (token, revoked) => { assert.equal(revoked, true); if (!['admin', 'student', 'teacher'].includes(token)) throw Error(); return { uid: token }; } }) };
const common = { 'server-only': {}, '@/server/firebase-admin': firebase, '@/lib/s3': s3, '@aws-sdk/client-s3': aws, '@/lib/lecture-resources': await load('src/lib/lecture-resources.ts') };
common['@/server/lecture-resources'] = await load('src/server/lecture-resources.ts', common);
common['@/server/open-courses'] = { openCourseRecord: async () => ({ published }) };
common['@/lib/student-inbox'] = await load('src/lib/student-inbox.ts');
const api = await load('src/app/api/student-inbox/route.ts', common);
process.env.S3_BUCKET_LESSONS = 'test-private'; delete process.env.VERCEL;
function reset() { records.clear(); objects.clear(); failStorage = false; failFinal = false; published = true; privateBucket = true; for (const role of ['admin','student','teacher']) records.set('users/' + role, { role }); }
const token = () => randomBytes(32).toString('hex');
const request = (method, input, role = '') => new Request('https://test.invalid/api/student-inbox', { method, headers: { 'Content-Type':'application/json', ...(role ? { Authorization: 'Bearer ' + role } : {}) }, ...(input ? { body: JSON.stringify(input) } : {}) });
const question = () => ({ action: 'submit', token: token(), courseId: 'number-systems', kind: 'question', title: 'Lesson one', message: 'Please explain binary.', name: '', website: '' });
const pdf = await PDFDocument.create(); pdf.addPage(); const file = { type: 'application/pdf', data: Buffer.from(await pdf.save()).toString('base64') };
test('private Q&A, secret receipt, administrator replies, revision guard and safe text', async () => {
  reset(); const input = question(); input.message = '<script>alert(1)</script>'; const response = await api.POST(request('POST', input)); assert.equal(response.status, 201); const saved = await response.json(); assert.equal(saved.status, 'under_review'); assert.equal(saved.fingerprint, undefined); assert.equal(saved.fileKey, undefined);
  for (const role of ['', 'teacher', 'student']) { assert.ok([401,403].includes((await api.GET(request('GET', null, role))).status)); assert.ok([401,403].includes((await api.PATCH(request('PATCH', { id: saved.id, status: 'reviewed', revision: 0, reply: 'Answer' }, role))).status)); }
  assert.equal((await api.POST(request('POST', { action:'status', token: token() }))).status,404);
  assert.equal((await api.POST(request('POST', { action:'status', token: saved.id }))).status,404);
  assert.equal((await api.PATCH(request('PATCH', { id: saved.id, status:'reviewed', revision:0, reply:'Binary uses two digits.' }, 'admin'))).status,200);
  assert.equal((await api.PATCH(request('PATCH', { id: saved.id, status:'reviewed', revision:0, reply:'stale' }, 'admin'))).status,409);
  const receipt = await (await api.POST(request('POST', { action:'status', token:input.token }))).json(); assert.equal(receipt.reply,'Binary uses two digits.'); assert.equal(receipt.message,input.message);
  assert.equal((await api.POST(request('POST', input))).status,200); assert.equal(records.get('studentInboxLimits/submissions').total,1);
});
test('PDF stored before confirmation; admin-only attachment; spoofed and unsafe inputs rejected', async () => {
  reset(); const input = { ...question(), kind:'assignment', file }; const response = await api.POST(request('POST', input)); assert.equal(response.status,201); const item = await response.json(); assert.equal(objects.size,1);
  for (const role of ['', 'teacher', 'student']) assert.ok([401,403].includes((await api.GET(new Request('https://test.invalid/api/student-inbox?file=' + item.id, { headers: { Authorization: 'Bearer ' + role } }))).status));
  const download = await api.GET(new Request('https://test.invalid/api/student-inbox?file=' + item.id, { headers: { Authorization: 'Bearer admin' } })); assert.equal(download.status,200); assert.match(download.headers.get('content-disposition'),/^attachment/); assert.equal(download.headers.get('x-content-type-options'),'nosniff'); assert.equal(download.headers.get('cache-control'),'no-store');
  for (const bad of [{ type:'application/zip',data:'AAAA' },{ type:'application/pdf',data:'AAAA' },{ type:'image/png',data:Buffer.from('<svg/>').toString('base64') }]) assert.equal((await api.POST(request('POST',{ ...input,token:token(),file:bad }))).status,400);
});
test('real PNG is decoded and reencoded, never served as uploaded active content', async () => { reset(); const png = await sharp({ create: { width:2,height:2,channels:3,background:'red' } }).png().toBuffer(); const response = await api.POST(request('POST',{ ...question(), kind:'assignment', file:{ type:'image/png',data:png.toString('base64') } })); assert.equal(response.status,201); assert.equal((await sharp([...objects.values()][0]).metadata()).format,'jpeg'); });
test('storage failures never report under review, private buckets and published courses required', async () => {
  for (const which of ['storage','final','private','published']) { reset(); if(which==='storage')failStorage=true; if(which==='final')failFinal=true; if(which==='private')privateBucket=false; if(which==='published')published=false; const input={ ...question(),kind:'assignment',file }; const response=await api.POST(request('POST',input)); assert.ok([404,503].includes(response.status)); for(const [key,value] of records)if(key.startsWith('studentInbox/'))assert.equal(value.status,'processing'); }
});
test('durable quota, duplicate conflict and bounded body', async () => {
  reset(); const input=question(); assert.equal((await api.POST(request('POST',input))).status,201); assert.equal((await api.POST(request('POST',{ ...input,title:'Changed' }))).status,409);
  for(let i=0;i<4;i++)assert.equal((await api.POST(request('POST',question()))).status,201); assert.equal((await api.POST(request('POST',question()))).status,429);
  const oversized = new Request('https://test.invalid',{method:'POST',headers:{'Content-Type':'application/json'},body:'x'.repeat(2_800_001)}); assert.equal((await api.POST(oversized)).status,413);
  const crossOrigin = new Request('https://test.invalid',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://evil.invalid'},body:JSON.stringify(question())}); assert.equal((await api.POST(crossOrigin)).status,403);
});
