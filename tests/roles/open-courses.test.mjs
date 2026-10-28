import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
async function load(path, mocks = {}) {
  const source = await readFile(new URL('../../' + path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => mocks[name] ?? require(name), module, module.exports);
  return module.exports;
}
const catalog = await load('src/lib/open-courses.ts');
const routes = await load('src/lib/route-access.ts');
test('only published anonymous-access courses enter the shared catalog', () => {
  const base = catalog.openCourseCatalog[0];
  const more = [base, { ...base, id: 'future', href: '/open-courses/future' }, { ...base, id: 'draft', published: false }, { ...base, id: 'free-but-login', price: 0, access: 'registration' }];
  assert.deepEqual(catalog.publishedOpenCourses(more).map(x => x.id), [base.id, 'future']);
  assert.equal(new Set(catalog.openCourseCatalog.map(x => x.id)).size, catalog.openCourseCatalog.length);
  for (const c of catalog.publishedOpenCourses()) {
    assert.equal(routes.routePolicyForPath(c.href).kind, 'public');
    for (const l of ['en', 'ar']) for (const key of ['title', 'details', 'description']) assert.ok(c[key][l]);
  }
});
test('shared section renders every eligible course in English and Arabic', async () => {
  for (const lang of ['en', 'ar']) {
    const courses = [...catalog.publishedOpenCourses(), { ...catalog.openCourseCatalog[0], id: 'second', href: '/open-courses/second' }];
    const { OpenCoursesSection } = await load('src/components/open-courses-section.tsx', {
      '@/lib/open-courses': { publishedOpenCourses: () => courses },
      '@/components/i18n/lang': { useLang: () => ({ lang, dir: lang === 'ar' ? 'rtl' : 'ltr' }) },
      '@/components/ui/button': { Button: ({ children }) => children },
      'lucide-react': { BookOpen: () => null, ArrowUpRight: () => null },
      'next/link': ({ children, ...props }) => React.createElement('a', props, children),
    });
    const html = renderToStaticMarkup(React.createElement(OpenCoursesSection, { homepage: true }));
    assert.equal((html.match(/<article/g) || []).length, courses.length);
    for (const course of courses) assert.ok(html.includes(`href="${course.href}"`));
    assert.ok(html.includes(lang === 'ar' ? 'دورات مجانية — دون تسجيل' : 'Free Courses — No Registration Required'));
  }
});
test('homepage, catalog and resources use the same section; homepage puts it after hero', async () => {
  for (const path of ['src/app/(public)/page.tsx', 'src/app/(public)/courses/page.tsx', 'src/components/lecture-resources.tsx']) {
    const source = await readFile(new URL('../../' + path, import.meta.url), 'utf8');
    assert.ok(source.includes('<OpenCoursesSection'));
    if (path.endsWith('(public)/page.tsx')) assert.match(source, /<Hero\s*\/>\s*<OpenCoursesSection homepage\s*\/>/);
  }
});
