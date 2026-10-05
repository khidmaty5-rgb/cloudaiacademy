import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const box = ({ children }) => React.createElement('div', null, children);
function load(path, mocks) {
  const source = readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  }}).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), module, module.exports);
  return module.exports;
}
function page(name, role, error = null, lang = 'en', data = []) {
  const queries = [];
  const mocks = {
    '@/firebase': { useUser: () => ({ user: { uid: 'test' } }), useMemoFirebase: fn => fn(),
      useCollection: q => { queries.push(q); return { data, error, isLoading: false }; } },
    'firebase/firestore': { getFirestore: () => ({}), collection: () => ({}), where: (...args) => args, query: (...args) => args },
    '@/hooks/useCurrentRole': { useCurrentRole: () => ({ isTeacher: role === 'teacher', isAdmin: role === 'admin', loading: false }) },
    '@/components/i18n/lang': { useLang: () => ({ lang }) },
    '@/components/ui/skeleton': { Skeleton: box },
    '@/components/ui/card': { Card: box, CardContent: box, CardHeader: box, CardTitle: box },
    '@/components/ui/table': Object.fromEntries(['Table','TableBody','TableCell','TableHead','TableHeader','TableRow'].map(k => [k, box])),
    '@/components/ui/button': { Button: box },
    '@/lib/course-images': { getCourseImage: () => ({ src: '/image.png' }) },
    'next/link': box, 'next/image': () => null,
    '@/components/LiveSessionButton': ({ label }) => React.createElement('button', null, label),
  };
  const Component = load(`src/app/teacher/${name}/page.tsx`, mocks).default;
  return { html: renderToStaticMarkup(React.createElement(Component)), queries };
}
for (const name of ['dashboard', 'courses']) {
  test(`${name}: admin and teacher have access; other roles do not query`, () => {
    for (const role of ['admin','teacher']) {
      const result = page(name, role);
      assert.doesNotMatch(result.html, /No permission/);
      assert.ok(result.queries.every(Boolean));
    }
    for (const role of ['student','editor','reviewer']) {
      const result = page(name, role);
      assert.match(result.html, /No permission/);
      assert.ok(result.queries.every(q => q === null));
    }
  });
  test(`${name}: failed queries show an alert, never an empty-course message`, () => {
    const { html } = page(name, 'teacher', new Error('denied'));
    assert.match(html, /role="alert"/);
    assert.match(html, /Retry/);
    assert.doesNotMatch(html, /You are not assigned/);
  });
}
test('Arabic dashboard translates course actions', () => {
  const { html } = page('dashboard', 'teacher', null, 'ar', [{ id: 'one', slug: 'one', title: 'Example' }]);
  assert.match(html, /إدارة الدروس/);
  assert.match(html, /بدء درس مباشر/);
  assert.doesNotMatch(html, /View Course|Manage Lessons|Start Live Class/);
});
test('production permission error renders a recoverable alert without throwing', () => {
  const Component = load('src/components/FirebaseErrorListener.tsx', {
    react: { ...React, useState: () => [new Error('denied'), () => {}], useEffect: () => {} },
    '@/firebase/error-emitter': {},
  }).FirebaseErrorListener;
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const html = renderToStaticMarkup(React.createElement(Component));
    assert.match(html, /role="alert"/);
    assert.match(html, /Dismiss/);
  } finally { process.env.NODE_ENV = previous; }
});
