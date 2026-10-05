import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const academy = JSON.parse(readFileSync(new URL('../../academy.config.json', import.meta.url), 'utf8'));
function load(path, mocks = {}) {
  mocks = { '@/lib/academy': { academy }, ...mocks };
  const code = ts.transpileModule(readFileSync(new URL('../../' + path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => mocks[name] ?? require(name), module, module.exports);
  return module.exports;
}
const live = load('src/lib/live.ts');
test('meeting URL validation rejects missing, unsafe and unrelated URLs', () => {
  for (const url of ['', ' ', 'javascript:alert(1)', 'http://meet.google.com/a', 'https://evil.example/a', 'https://meet.google.com/']) {
    assert.equal(live.getLiveUrl({ livePlatform: 'google-meet', liveMeetUrl: url }), null);
  }
  assert.equal(live.getLiveUrl({ livePlatform: 'google-meet', liveMeetUrl: ' https://meet.google.com/abc-defg-hij ' }), 'https://meet.google.com/abc-defg-hij');
});
test('unconfigured classrooms show role-aware setup guidance in both languages', () => {
  for (const role of ['admin', 'teacher', 'student', 'reviewer', 'editor']) for (const lang of ['en', 'ar']) {
    const Component = load('src/components/LiveSessionButton.tsx', {
      '@/lib/live': live,
      '@/hooks/useCurrentRole': { useCurrentRole: () => ({ isAdmin: role === 'admin', isTeacher: role === 'teacher', loading: false }) },
      '@/components/i18n/lang': { useLang: () => ({ lang }) },
      'next/link': ({ children, ...props }) => React.createElement('a', props, children),
    }).default;
    const render = course => renderToStaticMarkup(React.createElement(Component, { course }));
    const html = render({ slug: 'aws', livePlatform: 'none' });
    assert.equal(html.includes('/admin/courses/edit/aws#live-session-settings'), role === 'admin');
    assert.doesNotMatch(html, /target="_blank"/);
    const ready = render({ slug: 'aws', livePlatform: 'jitsi', liveJitsiRoom: 'class-one' });
    assert.match(ready, /https:\/\/meet.jit.si\/class-one/);
    assert.match(ready, /noopener noreferrer/);
    assert.match(ready, lang === 'ar' ? /الانضمام/ : /Join Live Session/);
  }
});
