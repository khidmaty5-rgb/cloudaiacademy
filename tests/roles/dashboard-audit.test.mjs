import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
function handlers(source, start, end, names, scope) {
  const code = ts.transpileModule(source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  return new Function('scope', `with(scope) { ${code}; return { ${names} }; }`)(scope);
}
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const response = review => ({ ok: true, json: async () => ({ review }) });
function reviewer(fetch) {
  const scope = { fetch, getAuth: () => ({ currentUser: { getIdToken: async () => 'test' } }),
    lang: 'en', toast: () => {}, fetchAssignments: () => {},
    reviewRequest: { current: 0 }, reviewSaveLock: { current: false },
    reviewArticle: null, reviewOpen: false, reviewLoading: false, reviewError: false, reviewSaving: false,
    recommendation: 'MINOR_REVISION', commentsToAuthor: '', commentsToEditor: '',
  };
  for (const key of ['reviewArticle','reviewOpen','reviewLoading','reviewError','reviewSaving','recommendation','commentsToAuthor','commentsToEditor']) {
    scope['set' + key[0].toUpperCase() + key.slice(1)] = value => { scope[key] = value; };
  }
  return { scope, ...handlers(read('src/app/reviewer/page.tsx'), '  const openReview =', '  return (', 'openReview, closeReview, submitReview', scope) };
}
test('failed B review load clears A text and cannot submit', async () => {
  let calls = 0;
  const r = reviewer(async () => { if (++calls === 1) return response({ commentsToAuthor: 'Private A comments', commentsToEditor: 'A only' }); throw Error('offline'); });
  await r.openReview('A', 'A'); r.closeReview(); await r.openReview('B', 'B');
  assert.equal(r.scope.commentsToAuthor, ''); assert.equal(r.scope.commentsToEditor, '');
  assert.equal(r.scope.reviewError, true); await r.submitReview(); assert.equal(calls, 2);
});
test('late A response cannot overwrite B or a closed dialog', async () => {
  const pending = deferred();
  const r = reviewer(url => url.includes('/A/') ? pending.promise : Promise.resolve(response({ commentsToAuthor: 'Correct B comments' })));
  const a = r.openReview('A', 'A'); await r.openReview('B', 'B');
  pending.resolve(response({ commentsToAuthor: 'Wrong A comments' })); await a;
  assert.equal(r.scope.commentsToAuthor, 'Correct B comments');
  r.closeReview(); assert.equal(r.scope.reviewArticle, null); assert.equal(r.scope.commentsToAuthor, '');
});
test('review submission is locked against double click and close while saving', async () => {
  const pending = deferred(); let posts = 0;
  const r = reviewer((_url, options) => options?.method === 'POST' ? (posts++, pending.promise) : Promise.resolve(response(null)));
  await r.openReview('B', 'B'); r.scope.commentsToAuthor = 'Valid review comments';
  const save = r.submitReview(); r.closeReview(); await r.submitReview();
  await new Promise(setImmediate); assert.equal(posts, 1); assert.equal(r.scope.reviewOpen, true);
  pending.resolve({ ok: true, json: async () => ({ ok: true }) }); await save;
  assert.equal(r.scope.reviewOpen, false); assert.equal(r.scope.reviewSaveLock.current, false);
});
test('payment save rejects not-ready reads and suppresses duplicate writes', async () => {
  const pending = deferred(); let writes = 0;
  const scope = { ready: false, saveLock: { current: false }, setSaving: () => {},
    sanitizePaymentSettings: value => value, draft: {}, DEFAULT_PAYMENT_SETTINGS: {}, settingsDocRef: {},
    setDoc: () => { writes++; return pending.promise; }, toast: () => {}, t: {},
  };
  const { handleSave } = handlers(read('src/app/admin/payment/page.tsx'), '  const handleSave =', '  return (', 'handleSave', scope);
  await handleSave(); assert.equal(writes, 0);
  scope.ready = true; const save = handleSave(); await handleSave(); assert.equal(writes, 1);
  pending.resolve(); await save;
  const source = read('src/app/admin/payment/page.tsx');
  assert.match(source, /loadedFor === user.uid && !isLoading && !paymentError/);
  assert.match(source, /loadedFor === user.uid\) return/);
});
test('free recommendations use published catalog, no duplicated enrollment reads or provider', () => {
  const source = read('src/components/dashboard/recommendations.tsx');
  assert.match(source, /buildCourseLearningPlan/); assert.match(source, /where\('status', '==', 'PUBLISHED'\)/);
  assert.doesNotMatch(source, /@\/ai|enrollments|Promise.all/);
  assert.match(read('src/ai/genkit.ts'), /const AI_AVAILABLE = false/);
  assert.match(read('src/ai/flows/quiz-generator.ts'), /throw new Error\('QUIZ_UNAVAILABLE'\)/);
  assert.doesNotMatch(read('src/components/learn/Quiz.tsx'), /generateQuiz|setScore|correctOption/);
});
test('error states, import drafts, bilingual metadata and waitlist warnings are preserved', () => {
  for (const path of ['src/app/admin/courses/page.tsx','src/app/admin/journal/page.tsx','src/app/journal/my-submissions/page.tsx','src/components/admin/LessonManager.tsx','src/app/(app)/profile/page.tsx']) assert.match(read(path), /DataLoadError/);
  assert.match(read('src/components/admin/LessonZipImport.tsx'), /Resume import/);
  assert.match(read('src/app/api/journal/submit/route.ts'), /\['en', 'ar', 'both'\]/);
  assert.doesNotMatch(read('src/app/journal/submit/page.tsx'), /language === 'both' \? 'en'/);
  assert.doesNotMatch(read('src/app/admin/waitlist/page.tsx'), /useFallbackQuery && indexRelatedError/);
});
test('Telegram queue and analytics communicate external service dependencies', () => {
  const telegram = read('src/components/teacher/telegram-workspace.tsx');
  assert.match(telegram, /Queued for delivery/); assert.match(telegram, /sendLock.current/);
  assert.match(telegram, /jobsError \?/);
  const analytics = read('src/app/admin/analytics/page.tsx');
  assert.match(analytics, /showDashboard &&/); assert.match(analytics, /External student progress analytics/);
});
test('overview uses aggregates and bounded lists; editorial loads more explicitly', () => {
  const overview = read('src/app/admin/dashboard/page.tsx');
  assert.match(overview, /getCountFromServer/); assert.match(overview, /limit\(50\)/); assert.match(overview, /limit\(100\)/);
  assert.doesNotMatch(overview, /if \(loadError\) \{\s*return/);
  assert.match(read('src/app/admin/journal/page.tsx'), /limit\(articleLimit\)/);
});
