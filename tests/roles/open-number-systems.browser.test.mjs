import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { test } from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
async function load(path, mocks = {}) {
  const source = await readFile(new URL('../../' + path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => mocks[name] ?? require(name), module, module.exports);
  return module.exports;
}
const policy = await load('src/lib/interactive-lesson.ts');
const routes = await load('src/lib/route-access.ts');
const lesson = JSON.parse(await readFile(new URL('../../src/content/number-systems.json', import.meta.url), 'utf8'));
const { InteractiveLessonPlayer } = await load('src/components/learn/interactive-lesson-player.tsx', {
  '@/lib/interactive-lesson': policy,
  '@/components/i18n/lang': { useLang: () => ({ lang: 'ar' }) },
  '@/components/ui/button': { Button: ({ children }) => React.createElement('button', {}, children) },
});

test('only the curated course is public; normal learning routes remain protected', () => {
  assert.equal(routes.routePolicyForPath('/open-courses/number-systems').kind, 'public');
  assert.equal(routes.routePolicyForPath('/open-courses/private-course').kind, 'denied');
  assert.equal(routes.routePolicyForPath('/learn/number-systems/lesson-1').kind, 'authenticated');
  assert.equal(routes.routePolicyForPath('/admin/resources').kind, 'roles');
  assert.ok(Buffer.byteLength(lesson.html) < policy.INTERACTIVE_HTML_LIMIT);
  assert.doesNotMatch(lesson.html, /@import|fonts\.googleapis\.com/);
  assert.match(lesson.html, /data:font\/woff2;base64,/);
});

test('supplied Arabic course works anonymously on desktop and mobile inside isolation', async () => {
  const markup = renderToStaticMarkup(React.createElement(InteractiveLessonPlayer, { html: lesson.html, title: 'Number Systems' }));
  const server = createServer((_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<!doctype html><style>body{margin:0}iframe{width:100%;height:760px;box-sizing:border-box}</style>' + markup);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.INTERACTIVE_TEST_BROWSER ? { executablePath: process.env.INTERACTIVE_TEST_BROWSER } : {}) });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [], externalRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    // Measure the lesson frame, not host-page traffic injected by local antivirus.
    page.on('request', req => { if (req.frame().parentFrame() && /^https?:/.test(req.url())) externalRequests.push(req.url()); });
    await page.goto('http://127.0.0.1:' + server.address().port);
    const frame = page.frameLocator('iframe');
    assert.equal(await page.locator('iframe').getAttribute('sandbox'), 'allow-scripts');
    await frame.locator('#out-10').filter({ hasText: '45' }).waitFor();
    await frame.locator('#base-select').selectOption('16');
    assert.equal(await frame.locator('#out-10').textContent(), '42');
    await frame.locator('#base-select').selectOption('10');
    await frame.locator('#number-input').fill('١٣');
    await frame.locator('#convert-btn').click();
    assert.equal(await frame.locator('#out-2').textContent(), '1101');
    await frame.locator('#base-select').selectOption('2');
    await frame.locator('#number-input').fill('102');
    await frame.locator('#convert-btn').click();
    assert.ok((await frame.locator('#lab-error').textContent()).length > 10);
    await frame.locator('#bit-switch').click();
    assert.equal(await frame.locator('#bit-switch').getAttribute('aria-checked'), 'true');
    for (const [i, value] of ['b', 'a', 'c', 'a', 'b'].entries()) await frame.locator(`input[name="q${i + 1}"][value="${value}"]`).check();
    await frame.locator('#quiz-grade').click();
    assert.match(await frame.locator('#quiz-result').textContent(), /100%/);
    await frame.locator('button[type="reset"]').click();
    assert.equal(await frame.locator('#quiz-result').isVisible(), false);
    await frame.locator('body').evaluate(async () => { await document.fonts.load('16px Cairo'); });
    assert.equal(await frame.locator('body').evaluate(() => document.fonts.check('16px Cairo')), true);
    const boundary = await frame.locator('body').evaluate(() => {
      try { return parent.document.title; } catch { return 'blocked'; }
    });
    assert.equal(boundary, 'blocked');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await frame.locator('body').evaluate(node => node.scrollWidth <= innerWidth + 1));
    await frame.locator('#top').scrollIntoViewIfNeeded();
    if (process.env.NUMBER_SYSTEMS_SCREENSHOT) await page.screenshot({ path: process.env.NUMBER_SYSTEMS_SCREENSHOT });
    assert.deepEqual(errors, []);
    assert.deepEqual(externalRequests, []);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
