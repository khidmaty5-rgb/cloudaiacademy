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
      if (req.method === 'DELETE') { let body='';for await(const c of req)body+=c;const data=JSON.parse(body);assert.equal(data.confirmation,'DELETE '+id);assert.equal(record.lifecycle,'trashed');record=null;pkg=null;res.end('{}');return; }
      if (req.method === 'PATCH') { let body = ''; for await (const c of req) body += c; const data = JSON.parse(body); record = { ...record, ...(data.action === 'trash' ? { lifecycle:'trashed',published:false } : data.action === 'restore' ? { lifecycle:undefined,published:false } : {}), ...data.metadata, ...(data.published === undefined ? {} : { published: data.published }), revision: record.revision + 1 }; res.end('{}'); return; }
      if (req.method === 'PUT') { let body = ''; for await (const c of req) body += c; const data = JSON.parse(body); assert.equal(data.id,id); assert.equal(data.revision,record.revision); assert.equal(record.published,false); pkg=data.package; record={...record,...data.metadata,revision:record.revision+1}; res.end('{}'); return; }
      if (req.url.startsWith('/api/open-courses/' + id)) { if (!record?.published && !req.url.includes('preview=1')) { res.statusCode = 404; res.end('{}'); return; } res.end(JSON.stringify({ course: record, package: pkg })); return; }
      // Simulate a first database page consisting entirely of deleted records.
      if(record && req.url.includes('manage=1') && !req.url.includes('after=')) { res.end(JSON.stringify({items:[],next:id}));return; }
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
    assert.equal(await page.getByRole('button',{name:'Load more',exact:true}).count(),0,'admin courses load automatically across empty storage pages');
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
    await page.getByRole('button',{name:'Manage modules',exact:true}).click();
    const editor=page.getByRole('region',{name:'Course modules',exact:true});
    await editor.getByRole('heading',{name:'Course modules (1)',exact:true}).waitFor();
    assert.equal(await editor.getByRole('button',{name:'Remove module',exact:true}).isEnabled(),false);
    // setInputFiles does not wait for enabled state; the async package load may
    // have rendered the editor before its operation lock is released.
    await page.waitForFunction(() => [...document.querySelectorAll('input[type=file]')].every(input => !input.disabled));
    await editor.getByLabel('Add module HTML / ZIP').setInputFiles({name:'second.html',mimeType:'text/html',buffer:Buffer.from('<title>Second module</title><p>Second content</p>')});
    await editor.getByRole('heading',{name:'Course modules (2)',exact:true}).waitFor();
    assert.equal(pkg.lessons.length,1,'changes stay local until saved');
    const second=editor.locator('li').filter({hasText:'Second module'});
    await second.getByRole('button',{name:'Rename module',exact:true}).click();
    await second.getByLabel('Module title').fill('Renamed module');
    await second.getByRole('button',{name:'Apply title',exact:true}).click();
    const renamed=editor.locator('li').filter({hasText:'Renamed module'});
    await renamed.getByRole('button',{name:'Move up',exact:true}).click();
    assert.match(await editor.locator('li').first().textContent(),/Renamed module/);
    await editor.locator('li').first().getByLabel('Replace module HTML / ZIP').setInputFiles({name:'replace.html',mimeType:'text/html',buffer:Buffer.from('<title>Replacement module</title><p>New individual content</p>')});
    await editor.getByText('1. Replacement module',{exact:true}).waitFor();
    // A multi-lesson ZIP is rejected, leaving the pending package intact.
    const multi=zipSync({'one.html':strToU8('<p>one</p>'),'two.html':strToU8('<p>two</p>')});
    await editor.getByLabel('Add module HTML / ZIP').setInputFiles({name:'multi.zip',mimeType:'application/zip',buffer:Buffer.from(multi)});
    await page.getByRole('alert').waitFor();
    assert.equal(await editor.locator('li').count(),2);
    await page.getByRole('button',{name:'Save details',exact:true}).click();
    await page.getByText('Private draft saved. Preview it from the list before publishing.',{exact:true}).waitFor();
    assert.equal(pkg.lessons.length,2);
    assert.match(pkg.lessons[0].interactiveHtml,/New individual content/);
    assert.match(pkg.lessons[1].interactiveHtml,/Revised activity/);
    await page.getByRole('button',{name:'Manage modules',exact:true}).click();
    await editor.locator('li').first().getByRole('button',{name:'Remove module',exact:true}).click();
    await editor.getByRole('heading',{name:'Course modules (1)',exact:true}).waitFor();
    await page.getByRole('button',{name:'Save details',exact:true}).click();
    await page.getByText('Private draft saved. Preview it from the list before publishing.',{exact:true}).waitFor();
    assert.equal(pkg.lessons.length,1); assert.match(pkg.lessons[0].interactiveHtml,/Revised activity/);
    await page.getByRole('button',{name:'Publish',exact:true}).click();
    await page.getByText('Public — no registration').waitFor();
    await page.getByRole('button',{name:'Manage modules',exact:true}).click();
    await page.getByText('To edit modules, withdraw this course first.',{exact:false}).waitFor();
    assert.equal(await page.getByLabel('Add module HTML / ZIP').count(),0);
    await page.getByRole('button',{name:'Withdraw',exact:true}).click();
    await page.getByText('Private draft',{exact:true}).waitFor();
    await page.goto(origin + '/manage?ar'); await page.getByRole('heading', { name: 'إدارة الدورات المفتوحة' }).waitFor(); await page.getByRole('button', { name: 'معاينة الدورة المحفوظة' }).click(); await page.locator('iframe').waitFor();
    await page.getByRole('button', { name: 'عرض / إخفاء المعاينة' }).click();
    await page.getByRole('button',{name:'إدارة الوحدات',exact:true}).click();
    const arabicEditor=page.getByRole('region',{name:'وحدات الدورة',exact:true});
    await arabicEditor.getByRole('button',{name:'إعادة تسمية الوحدة',exact:true}).click();
    await arabicEditor.getByLabel('عنوان الوحدة').fill('وحدة تجريبية');
    await arabicEditor.getByRole('button',{name:'تطبيق العنوان',exact:true}).click();
    await arabicEditor.getByText('1. وحدة تجريبية',{exact:true}).waitFor();
    assert.equal(pkg.lessons[0].title,'Revised lesson','Arabic unsaved edit does not mutate persisted package');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Arabic mobile page must not overflow');
    if (process.env.LAYOUT_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.LAYOUT_SCREENSHOT_DIR, 'open-courses-layout-ar-mobile.png'), fullPage: true });
    await page.goto(origin+'/manage');
    await page.getByRole('button',{name:'Move to Trash',exact:true}).click();
    await page.getByText('Moved to Trash. Public access is blocked; student work is retained.',{exact:true}).waitFor();
    assert.equal(record.lifecycle,'trashed');assert.equal(record.published,false);
    assert.equal(await page.getByRole('button',{name:'Edit details',exact:true}).count(),0);
    await page.getByRole('button',{name:'View Trash',exact:true}).click();
    await page.getByRole('button',{name:'Restore as draft',exact:true}).click();
    await page.getByText('Restored as a private draft. Preview before publishing.',{exact:true}).waitFor();
    assert.equal(record.lifecycle,undefined);assert.equal(record.published,false);
    await page.goto(origin+'/manage?ar');
    await page.getByRole('button',{name:'نقل إلى سلة المحذوفات',exact:true}).click();
    await page.getByText('نُقلت إلى سلة المحذوفات. أُوقف الوصول العام مع الاحتفاظ بأعمال الطلاب.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'عرض سلة المحذوفات',exact:true}).click();
    await page.getByRole('button',{name:'حذف نهائي',exact:true}).click();
    const confirm=page.getByRole('region',{name:'تأكيد الحذف النهائي',exact:true});
    assert.equal(await confirm.getByRole('button',{name:'تأكيد الحذف النهائي',exact:true}).isEnabled(),false);
    await confirm.getByRole('button',{name:'إلغاء الحذف',exact:true}).click();assert.ok(record);
    await page.getByRole('button',{name:'حذف نهائي',exact:true}).click();
    await confirm.getByLabel('تأكيد الحذف',{exact:true}).fill('DELETE '+id);
    await confirm.getByRole('button',{name:'تأكيد الحذف النهائي',exact:true}).click();
    await page.getByText('أُزيلت الدورة نهائيًا مع الاحتفاظ بأعمال الطلاب.',{exact:true}).waitFor();
    assert.equal(record,null);assert.equal(pkg,null);
    assert.deepEqual(errors, []);
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
});
