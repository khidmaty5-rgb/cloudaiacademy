import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { zipSync, strToU8 } from 'fflate';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import { readFile } from 'node:fs/promises';
const root = fileURLToPath(new URL('../../', import.meta.url));
test('ZIP -> draft -> saved preview -> metadata edit -> publish -> guest player -> withdraw, EN/AR', async () => {
  const mocks = {
    '@/firebase': `const user={getIdToken:async()=>'admin-test'};export const useUser=()=>({user});`,
    '@/components/i18n/lang': `export const useLang=()=>({lang:location.search.includes('ar')?'ar':'en',dir:location.search.includes('ar')?'rtl':'ltr'});`,
    'next/link': `import React from 'react';export default function Link({href,children,...props}){return React.createElement('a',{href,...props},children);}`,
  };
  const bundle = await build({ absWorkingDir: root, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, alias: { '@': path.join(root, 'src') },
    stdin: { resolveDir: root, loader: 'jsx', contents: `import React from 'react';import{createRoot}from'react-dom/client';import Manage from './src/components/manage-open-courses';import{OpenCoursesSection}from './src/components/open-courses-section';import Player from './src/components/open-course-player';const p=location.pathname;createRoot(document.getElementById('root')).render(p==='/manage'?<Manage/>:p.startsWith('/open-courses/')?<Player id={p.split('/').pop()}/>:<OpenCoursesSection homepage/>);` },
    plugins: [{ name: 'mocks', setup(b) { b.onResolve({ filter: /.*/ }, a => a.path in mocks ? { path: a.path, namespace: 'mock' } : null); b.onLoad({ filter: /.*/, namespace: 'mock' }, a => ({ contents: mocks[a.path], loader: 'js', resolveDir: root })); } }],
  });
  let record = null, pkg = null; const errors = [];
  const css = await postcss([tailwind(path.join(root, 'tailwind.config.ts'))]).process(await readFile(path.join(root, 'src/app/globals.css'), 'utf8'), { from: path.join(root, 'src/app/globals.css') });
  const id = '11111111-1111-4111-8111-111111111111';
  const server = createServer(async (req, res) => {
    if (req.url.startsWith('/api/open-courses')) {
      res.setHeader('Content-Type', 'application/json');
      if (req.method === 'POST') { let body = ''; for await (const c of req) body += c; const data = JSON.parse(body); pkg = data.package; record = { ...data.metadata, id, href: '/open-courses/' + id, access: 'open', published: false, revision: 1, details: { en: 'Arabic · 90 minutes', ar: 'العربية · 90 دقيقة' } }; res.statusCode = 201; res.end(JSON.stringify({ id })); return; }
      if (req.method === 'PATCH') { let body = ''; for await (const c of req) body += c; const data = JSON.parse(body); record = { ...record, ...data.metadata, ...(data.published === undefined ? {} : { published: data.published }), revision: record.revision + 1 }; res.end('{}'); return; }
      if (req.method === 'PUT') { let body = ''; for await (const c of req) body += c; const data = JSON.parse(body); assert.equal(data.id,id); assert.equal(data.revision,record.revision); assert.equal(record.published,false); pkg=data.package; record={...record,...data.metadata,revision:record.revision+1}; res.end('{}'); return; }
      if (req.url.startsWith('/api/open-courses/' + id)) { if (!record?.published && !req.url.includes('preview=1')) { res.statusCode = 404; res.end('{}'); return; } res.end(JSON.stringify({ course: record, package: pkg })); return; }
      res.end(JSON.stringify({ items: record && (record.published || req.url.includes('manage=1')) ? [record] : [], next: null })); return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<!doctype html><meta name="viewport" content="width=device-width"><style>' + css.css + '</style><div id="root"></div><script>' + bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script') + '</script>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.INTERACTIVE_TEST_BROWSER ? { executablePath: process.env.INTERACTIVE_TEST_BROWSER } : {}) });
    const page = await browser.newPage(); page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
    const origin = 'http://127.0.0.1:' + server.address().port;
    await page.goto(origin + '/manage');
    await page.getByText('Your first open course starts here').waitFor();
    await page.setViewportSize({ width: 1440, height: 1000 });
    if (process.env.LAYOUT_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.LAYOUT_SCREENSHOT_DIR, 'open-courses-layout-en.png'), fullPage: true });
    const zip = zipSync({ 'index.html': strToU8('<html><head><title>My test course</title></head><body><button onclick="this.textContent=42">Try</button></body></html>') });
    await page.getByLabel('Interactive ZIP (up to 10 MB)').setInputFiles({ name: 'course.zip', mimeType: 'application/zip', buffer: Buffer.from(zip) });
    await page.getByLabel('Title (required; any language)').waitFor();
    const image = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 40; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#4080cc'; ctx.fillRect(0, 0, 80, 40); return canvas.toDataURL('image/png').split(',')[1]; });
    await page.getByLabel('Course image (optional)').setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') });
    await page.getByAltText('Course image preview').waitFor();
    await page.getByRole('button', { name: 'Save private draft' }).click();
    await page.getByText('Private draft', { exact: true }).waitFor(); assert.equal(record.published, false); assert.match(record.image, /^data:image\/jpeg;base64,/);
    const guest = await browser.newPage(); guest.on('pageerror', e => errors.push(e.message)); await guest.goto(origin); assert.equal(await guest.locator('article').count(), 0);
    await page.getByRole('button', { name: 'Preview saved course' }).click();
    await page.frameLocator('iframe').getByRole('button', { name: 'Try' }).click();
    assert.equal(await page.frameLocator('iframe').getByRole('button').textContent(), '42');
    await page.getByLabel('Title (required; any language)').fill('Updated open course');
    await page.getByRole('button', { name: 'Save details' }).click(); await page.getByRole('heading', { name: 'Updated open course' }).waitFor();
    await page.getByRole('button', { name: 'Publish', exact: true }).click(); await page.getByText('Public — no registration').waitFor();
    await guest.reload(); await guest.getByRole('link', { name: 'Start course without registration' }).click(); await guest.frameLocator('iframe').getByRole('button', { name: 'Try' }).click();
    assert.equal(await guest.frameLocator('iframe').getByRole('button').textContent(), '42');
    await page.getByRole('button', { name: 'Withdraw', exact: true }).click(); await page.getByText('Private draft', { exact: true }).waitFor();
    await guest.reload(); await guest.getByRole('heading', { name: 'Course currently unavailable' }).waitFor(); assert.equal(await guest.locator('iframe').count(), 0);
    await page.getByRole('button', {name:'Edit details',exact:true}).click();
    const replacement = zipSync({'index.html':strToU8('<html><head><title>Revised lesson</title></head><body><button onclick="this.textContent=99">Revised activity</button></body></html>')});
    await page.getByLabel('Replace draft ZIP (optional)').setInputFiles({name:'revised.zip',mimeType:'application/zip',buffer:Buffer.from(replacement)});
    await page.frameLocator('iframe').getByRole('button',{name:'Revised activity'}).waitFor();
    await page.getByRole('button',{name:'Save details',exact:true}).click();
    await page.getByText('Private draft',{exact:true}).waitFor();
    assert.equal(record.id,id); assert.equal(record.published,false);
    await page.getByRole('button',{name:'Preview saved course',exact:true}).click();
    await page.frameLocator('iframe').getByRole('button',{name:'Revised activity'}).click();
    assert.equal(await page.frameLocator('iframe').getByRole('button').textContent(),'99');
    await page.goto(origin + '/manage?ar'); await page.getByRole('heading', { name: 'إدارة الدورات المفتوحة' }).waitFor(); await page.getByRole('button', { name: 'معاينة الدورة المحفوظة' }).click(); await page.locator('iframe').waitFor();
    await page.getByRole('button', { name: 'عرض / إخفاء المعاينة' }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Arabic mobile page must not overflow');
    if (process.env.LAYOUT_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.LAYOUT_SCREENSHOT_DIR, 'open-courses-layout-ar-mobile.png'), fullPage: true });
    assert.deepEqual(errors, []);
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
});
