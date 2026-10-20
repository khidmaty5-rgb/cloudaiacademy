import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('public menu visibility cannot redirect authenticated author tools', async () => {
  for (const page of ['submit', 'my-submissions', 'revise/[id]']) {
    const source = await read(`src/app/journal/${page}/page.tsx`);
    assert.ok(!source.includes('showJournalNav'), page);
    assert.ok(!/router\.replace\(['"]\/['"]\)/.test(source), page);
    assert.match(source, /!isUserLoading && !user/, `${page} retains login guard`);
    assert.match(source, /router\.push\(['"]\/login['"]\)/);
  }
});

test('author workflow returns to own submissions and retains ownership scoping', async () => {
  const submit = await read('src/app/journal/submit/page.tsx');
  const list = await read('src/app/journal/my-submissions/page.tsx');
  const revise = await read('src/app/journal/revise/[id]/page.tsx');
  assert.ok(submit.includes("router.push('/journal/my-submissions')"));
  assert.ok(list.includes('where("createdBy", "==", user.uid)'));
  assert.ok(revise.includes('article.createdBy !== user.uid'));
  assert.ok(revise.includes('if (!canRevise)'));
});

test('deployment feature switch and public journal visibility are preserved', async () => {
  const middleware = await read('src/middleware.ts');
  const academy = await read('src/lib/academy.ts');
  const header = await read('src/components/landing/header.tsx');
  assert.ok(middleware.includes('academyPathEnabled(request.nextUrl.pathname)'));
  assert.ok(academy.includes("'/api/journal'"));
  assert.ok(header.includes('settings?.showJournalNav !== false'));
});
