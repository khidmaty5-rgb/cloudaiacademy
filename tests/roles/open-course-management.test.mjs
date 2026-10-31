import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import ts from 'typescript';
const require = createRequire(import.meta.url);
async function load(path, mocks = {}) {
  const code = ts.transpileModule(await readFile(new URL('../../' + path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => mocks[name] ?? require(name), module, module.exports); return module.exports;
}
const records = new Map(), objects = new Map(); let privateBucket = true, failCreate = false;
const snap = path => ({ id: path.split('/').at(-1), exists: records.has(path), data: () => records.get(path) });
const ref = path => ({ path, get: async () => snap(path), create: async data => { if (failCreate) throw Error('write failed'); records.set(path, data); } });
const query = (prefix, published = false, after = '', count = 20) => ({
  where: () => query(prefix, true, after, count), orderBy: () => query(prefix, published, after, count), limit: n => query(prefix, published, after, n), startAfter: id => query(prefix, published, id, count),
  get: async () => { const docs = [...records.keys()].filter(k => k.startsWith(prefix + '/')).map(snap).filter(x => (!published || x.data().published === true) && x.id > after).sort((a, b) => a.id.localeCompare(b.id)).slice(0, count); return { docs, size: docs.length }; },
});
const db = { doc: ref, collection: query, runTransaction: fn => fn({ get: r => r.get(), set: (r, value) => records.set(r.path, value) }) };
const firebase = { getFirebaseAdminFirestore: () => db, getFirebaseAdminAuth: () => ({ verifyIdToken: async (token, revoked) => { assert.equal(revoked, true); if (!['admin', 'teacher', 'student', 'stale', 'editor'].includes(token)) throw Error(); return { uid: token, role: 'admin' }; } }) };
const aws = Object.fromEntries(['PutObject', 'GetObject', 'DeleteObject', 'GetBucketAcl', 'GetBucketPolicy'].map(kind => [kind + 'Command', class { constructor(input) { this.kind = kind; this.input = input; } }]));
const s3 = { getS3Client: () => ({ send: async command => {
  const { Key, Body } = command.input;
  if (command.kind === 'GetBucketAcl') return { Grants: privateBucket ? [] : [{ Grantee: { URI: 'AllUsers' } }] };
  if (command.kind === 'GetBucketPolicy') { const e = Error(); e.name = 'NoSuchBucketPolicy'; throw e; }
  if (command.kind === 'PutObject') objects.set(Key, Body);
  if (command.kind === 'DeleteObject') objects.delete(Key);
  if (command.kind === 'GetObject') { if (!objects.has(Key)) throw Error('missing'); return { ContentLength: Buffer.byteLength(objects.get(Key)), Body: { transformToWebStream: () => new Blob([objects.get(Key)]).stream() } }; }
  return {};
} }) };
const pkgLib = await load('src/lib/lesson-package.ts');
const catalog = await load('src/lib/open-courses.ts');
const metadataLib = await load('src/lib/open-course-management.ts', { './lesson-package': pkgLib });
const lectureLib = await load('src/lib/lecture-resources.ts');
const common = { 'server-only': {}, '@/server/firebase-admin': firebase, '@/lib/s3': s3, '@aws-sdk/client-s3': aws, 'firebase-admin/firestore': { FieldPath: { documentId: () => '__name__' } }, '@/lib/lesson-package': pkgLib, '@/lib/open-course-management': metadataLib, '@/lib/open-courses': catalog };
common['@/server/lecture-resources'] = await load('src/server/lecture-resources.ts', { ...common, '@/lib/lecture-resources': lectureLib });
common['@/server/open-courses'] = await load('src/server/open-courses.ts', { ...common, '@/content/number-systems.json': { html: '<p>Builtin lesson</p>' } });
const api = await load('src/app/api/open-courses/route.ts', common);
const detail = await load('src/app/api/open-courses/[id]/route.ts', common);
process.env.S3_BUCKET_LESSONS = 'test-only-bucket';
const base = 'https://academy.test/api/open-courses';
const metadata = { title: { en: 'Test course', ar: 'دورة اختبار' }, description: { en: 'Description', ar: '' }, language: 'ar', minutes: 90, image: '' };
const pkg = { lessons: [{ key: 'l0', title: 'Test lesson', nodes: [], interactiveHtml: '<button onclick="this.textContent=42">Try</button>' }] };
const auth = token => token ? { Authorization: 'Bearer ' + token } : {};
const req = (method, data, token = 'admin') => new Request(base, { method, headers: auth(token), body: JSON.stringify(data) });
const list = (manage = false, token = 'admin', after = '') => api.GET(new Request(base + (manage ? '?manage=1' : '?') + (after ? '&after=' + after : ''), { headers: manage ? auth(token) : {} }));
const content = (id, preview = false, token = 'admin') => detail.GET(new Request(base + '/' + id + (preview ? '?preview=1' : ''), { headers: preview ? auth(token) : {} }), { params: Promise.resolve({ id }) });
function seed() { records.clear(); objects.clear(); privateBucket = true; failCreate = false; for (const role of ['admin', 'teacher', 'student', 'editor', 'stale']) records.set('users/' + role, { role: role === 'stale' ? 'student' : role }); }
test('replace private draft atomically, preserve old bytes and reject published/stale/non-admin updates', async () => {
  seed(); const { id } = await (await api.POST(req('POST', { metadata, package: pkg }))).json();
  const updated = { lessons: [{ ...pkg.lessons[0], title: 'Revised lesson', interactiveHtml: '<h1>Revised material</h1>' }] };
  for (const role of ['', 'student', 'teacher', 'stale']) assert.ok([401,403].includes((await api.PUT(req('PUT', { id, revision: 1, metadata, package: updated }, role))).status));
  assert.equal((await api.PUT(req('PUT', { id, revision: 1, metadata, package: updated }))).status,200);
  assert.equal(records.get('openCourses/' + id).published,false);
  assert.equal(records.get('openCourses/' + id).revision,2);
  assert.ok(objects.has('open-courses/' + id + '.json'), 'old version retained');
  assert.equal((await (await content(id,true)).json()).package.lessons[0].title,'Revised lesson');
  assert.equal((await content(id)).status,404);
  assert.equal((await api.PUT(req('PUT', { id, revision: 1, metadata, package: pkg }))).status,409);
  assert.equal((await api.PUT(req('PUT', { id, revision: 2, metadata, package: {} }))).status,400);
  assert.equal((await api.PATCH(req('PATCH', { id, revision: 2, published: true }))).status,200);
  assert.equal((await api.PUT(req('PUT', { id, revision: 3, metadata, package: pkg }))).status,409);
  assert.equal((await (await content(id)).json()).package.lessons[0].title,'Revised lesson');
  assert.equal((await api.PUT(req('PUT', { id:'number-systems', revision:1, metadata, package:pkg }))).status,400);
});
test('draft -> private preview -> public course -> withdrawal; no private fields exposed', async () => {
  seed(); const saved = await api.POST(req('POST', { metadata, package: pkg })); assert.equal(saved.status, 201); const { id } = await saved.json();
  assert.equal((await content(id)).status, 404); assert.equal((await content(id, true)).status, 200);
  assert.equal((await (await list()).json()).items.length, 1); // built-in only
  assert.equal((await api.PATCH(req('PATCH', { id, revision: 1, published: true }))).status, 200);
  const publicList = await (await list()).json(); const item = publicList.items.find(x => x.id === id);
  assert.ok(item); assert.equal(item.createdBy, undefined); assert.equal(item.key, undefined);
  const publicContent = await content(id); assert.equal(publicContent.status, 200); assert.equal(publicContent.headers.get('cache-control'), 'no-store');
  assert.equal((await publicContent.json()).package.lessons[0].interactiveHtml, pkg.lessons[0].interactiveHtml);
  assert.equal((await api.PATCH(req('PATCH', { id, revision: 2, published: false }))).status, 200);
  assert.equal((await content(id)).status, 404); assert.equal((await (await list()).json()).items.some(x => x.id === id), false);
});
test('anonymous and non-admin roles including stale admin claims cannot mutate or preview', async () => {
  seed(); for (const token of [null, 'student', 'teacher', 'editor', 'stale', 'invalid']) {
    const expected = !token || token === 'invalid' ? 401 : 403;
    assert.equal((await api.POST(req('POST', { metadata, package: pkg }, token))).status, expected);
    assert.equal((await api.PATCH(req('PATCH', { id: 'number-systems', revision: 0, published: false }, token))).status, expected);
    assert.equal((await list(true, token)).status, expected);
    assert.equal((await content('number-systems', true, token)).status, expected);
  } assert.equal(objects.size, 0);
});
test('withdrawn built-in stays withdrawn and concurrent stale edits are rejected', async () => {
  seed(); assert.equal((await content('number-systems')).status, 200);
  assert.equal((await api.PATCH(req('PATCH', { id: 'number-systems', revision: 0, published: false }))).status, 200);
  assert.equal((await (await list()).json()).items.length, 0); assert.equal((await content('number-systems')).status, 404);
  assert.equal((await api.PATCH(req('PATCH', { id: 'number-systems', revision: 0, published: true }))).status, 409);
  assert.equal((await api.PATCH(req('PATCH', { id: 'number-systems', revision: 1, metadata: { ...metadata, title: { en: 'Renamed', ar: '' } } }))).status, 200);
  assert.equal((await content('number-systems')).status, 404);
  assert.equal((await api.PATCH(req('PATCH', { id: 'number-systems', revision: 2, published: true }))).status, 200);
  assert.equal((await (await content('number-systems')).json()).course.title.en, 'Renamed');
});
test('bounded/invalid data, unsafe paths, missing content and public storage fail closed', async () => {
  seed(); assert.equal((await api.POST(req('POST', { metadata, package: { lessons: [] } }))).status, 400);
  assert.equal((await api.POST(req('POST', { metadata: { ...metadata, image: 'https://evil.test/a.png' }, package: pkg }))).status, 400);
  assert.equal((await api.POST(new Request(base, { method: 'POST', headers: auth('admin'), body: 'x'.repeat(3_000_001) }))).status, 413);
  assert.equal((await content('../private')).status, 404);
  assert.equal((await api.GET(new Request(base + '?after=bad'))).status, 400);
  privateBucket = false; assert.equal((await api.POST(req('POST', { metadata, package: pkg }))).status, 503); assert.equal(objects.size, 0);
  privateBucket = true; failCreate = true; assert.equal((await api.POST(req('POST', { metadata, package: pkg }))).status, 503); assert.equal(objects.size, 0);
  failCreate = false; const { id } = await (await api.POST(req('POST', { metadata, package: pkg }))).json(); objects.clear();
  assert.equal((await api.PATCH(req('PATCH', { id, revision: 1, published: true }))).status, 503);
  assert.equal(records.get('openCourses/' + id).published, false);
});
test('pagination exposes all published entries without drafts or duplicate fallback', async () => {
  seed(); for (let n = 0; n < 25; n++) records.set(`openCourses/${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`, { ...metadata, published: true, revision: 1 });
  const first = await (await list()).json(); assert.equal(first.items.length, 21); assert.ok(first.next);
  const second = await (await list(false, 'admin', first.next)).json(); assert.equal(second.items.length, 5); assert.equal(second.next, null);
  assert.equal(new Set([...first.items, ...second.items].map(x => x.id)).size, 26);
});
