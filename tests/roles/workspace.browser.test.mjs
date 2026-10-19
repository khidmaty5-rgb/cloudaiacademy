import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import postcss from 'postcss';
import tailwind from 'tailwindcss';

const root = fileURLToPath(new URL('../../', import.meta.url));
const mocks = {
  'next/navigation': `export const usePathname=()=>window.qaPath;export const useRouter=()=>({replace:()=>{},push:()=>{}});`,
  'next/link': `import React from 'react';export default function Link({href,children,...props}){return <a href={href} {...props} onClick={e=>{e.preventDefault();props.onClick?.();window.qaPath=href;window.qaRender()}}>{children}</a>}`,
  'next/image': `import React from 'react';export default function Image({priority,...props}){return <img {...props}/>}`,
  '@/components/i18n/lang': `export const useLang=()=>({lang:window.qaLang,dir:window.qaLang==='ar'?'rtl':'ltr',setLang:()=>{}});`,
  '@/firebase': `import {useMemo} from 'react';const user={uid:'actor',displayName:'QA Administrator',getIdToken:async()=>'fixture-token'};export const useMemoFirebase=(fn,deps)=>useMemo(fn,deps);export const useUser=()=>({user,isUserLoading:false});export const useDoc=()=>({data:{showJournalNav:true},isLoading:false});export const useCollection=()=>({data:[],isLoading:false});`,
  'firebase/firestore': `const db={};export const getFirestore=()=>db;export const doc=()=>({});export const collection=()=>({});export const query=()=>({});export const orderBy=()=>({});export const documentId=()=>'';export const limit=()=>({});export const startAfter=()=>({});`,
  '@/hooks/useCurrentRole': `export const useCurrentRole=()=>({role:window.qaRole,isAdmin:window.qaRole==='admin',loading:false});`,
  '@/lib/auth': `export const signOutUser=async()=>{};`,
  '@/lib/user': `export const updateUserRole=async(uid,role)=>{window.qaRequests.push({uid,role});if(window.qaFailure)throw Error('LAST_ADMINISTRATOR');return{claimsSyncPending:false}};`,
  '@/hooks/use-toast': `export const useToast=()=>({toast:value=>window.qaToasts.push(value)});`,
};
let browser, server, origin;
before(async () => {
  const result = await build({ absWorkingDir: root, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, alias: { '@': path.join(root, 'src') },
    stdin: { resolveDir: root, loader: 'jsx', contents: `import React from 'react';import{createRoot}from'react-dom/client';import{WorkspaceShell}from'./src/components/layout/workspace-shell';import{RoleSelector}from'./src/app/admin/users/page';import Recovery from './src/components/admin/RoleClaimRecovery';const root=createRoot(document.getElementById('root'));window.qaRender=()=>root.render(window.qaMode==='recovery'?<Recovery/>:window.qaMode==='role'?<RoleSelector userId={window.qaSelf?'actor':'target'} currentRole="student" identity="learner@example.invalid"/>:<WorkspaceShell><main><div className="container max-w-xl"><h1>QA workspace</h1><p>Content</p></div></main></WorkspaceShell>);window.qaRender();` },
    plugins: [{ name: 'services', setup(b) { b.onResolve({ filter: /.*/ }, a => a.path in mocks ? { path: a.path, namespace: 'services' } : null); b.onLoad({ filter: /.*/, namespace: 'services' }, a => ({ contents: mocks[a.path], loader: 'jsx', resolveDir: root })); } }],
  });
  const css = (await postcss([tailwind(path.join(root, 'tailwind.config.ts'))]).process(await readFile(path.join(root, 'src/app/globals.css'), 'utf8'), { from: undefined })).css;
  const bundle = result.outputFiles[0].text;
  server = createServer((req, res) => {
    if (req.url === '/app.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle); }
    else if (req.url === '/app.css') { res.setHeader('Content-Type', 'text/css'); res.end(css); }
    else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, ...(process.env.INTERACTIVE_TEST_BROWSER ? { executablePath: process.env.INTERACTIVE_TEST_BROWSER } : {}) });
});
after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });
async function pageFor({ role = 'admin', lang = 'en', width = 1440, mode = 'workspace', self = false } = {}) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.addInitScript(({ role, lang, mode, self }) => {
    window.qaRole = role; window.qaLang = lang; window.qaMode = mode; window.qaSelf = self;
    window.qaPath = role === 'admin' ? '/admin/dashboard' : role === 'teacher' ? '/teacher/dashboard' : role === 'editor' ? '/admin/journal' : role === 'reviewer' ? '/reviewer' : '/dashboard';
    window.qaRequests = []; window.qaToasts = [];
    window.qaPending = [{id:'request-000000001',targetUid:'target',newRole:'admin'}];
    const nativeFetch=window.fetch;
    window.fetch=async(url,options)=>{
      if(url!=='/api/admin/role-sync') return nativeFetch(url,options);
      if(options?.method==='POST') {
        window.qaRequests.push(JSON.parse(options.body));
        if(window.qaFailure)return new Response('{}',{status:503});
        window.qaPending=[];
        return new Response('{"ok":true}',{status:200});
      }
      return new Response(JSON.stringify({events:window.qaPending}),{status:200});
    };
  }, { role, lang, mode, self });
  await page.goto(origin);
  return page;
}
test('five-role menus at desktop and mobile in both languages; form widths survive', async () => {
  for (const role of ['admin', 'teacher', 'editor', 'reviewer', 'student']) for (const lang of ['en', 'ar']) for (const width of [390, 1440]) {
    const page = await pageFor({ role, lang, width });
    try {
      await page.getByRole('heading', { name: 'QA workspace' }).waitFor();
      assert.ok(await page.locator('main .container').evaluate(el => el.getBoundingClientRect().width <= 580));
      if (width === 390) await page.getByRole('button', { name: lang === 'ar' ? 'فتح القائمة' : 'Open navigation' }).click();
      const nav = page.getByRole('navigation', { name: lang === 'ar' ? 'قائمة مساحة العمل' : 'Workspace navigation' }).filter({ visible: true });
      await nav.waitFor();
      assert.equal(await nav.locator('[aria-current="page"]').count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (role === 'student') {
        const research = nav.locator('details').filter({ has: page.locator('a[href="/research"]') });
        assert.equal(await research.getAttribute('open'), null, 'secondary research tools start collapsed');
        await research.locator('summary').click();
        await nav.locator('a[href="/journal/my-submissions"]').waitFor();
        await nav.locator('a[href="/journal/submit"]').waitFor();
        await nav.locator('a[href="/research"]').click();
        assert.equal(await page.evaluate(() => window.qaPath), '/research');
        if (width === 390) await page.getByRole('button', { name: lang === 'ar' ? 'فتح القائمة' : 'Open navigation' }).click();
        await nav.locator('a[href="/research"][aria-current="page"]').waitFor();
      }
      if (role === 'admin') {
        await page.getByRole('combobox', { name: lang === 'ar' ? 'اختر مساحة العمل' : 'Choose workspace' }).filter({ visible: true }).click();
        await page.getByRole('option', { name: lang === 'ar' ? 'التدريس' : 'Teaching', exact: true }).click();
        await nav.locator('a[href="/teacher/dashboard"]').waitFor();
        assert.equal(await nav.locator('a[href="/admin/users"]').count(), 0);
        await nav.locator('a[href="/teacher/dashboard"]').click();
        assert.equal(await page.evaluate(() => window.qaPath), '/teacher/dashboard');
      }
    } finally { await page.close(); }
  }
});
test('Spark recovery UI keeps failures visible and retries without replaying a role value', async () => {
  for (const lang of ['en','ar']) {
    const page=await pageFor({mode:'recovery',lang,width:390});
    try {
      const label=lang==='ar'?'إعادة مزامنة الدور الحالي':'Retry current role sync';
      await page.getByRole('button',{name:label}).waitFor();
      await page.evaluate(()=>{window.qaFailure=true;});
      await page.getByRole('button',{name:label}).click();
      await page.getByRole('alert').waitFor();
      assert.equal(await page.getByRole('button',{name:label}).count(),1);
      await page.evaluate(()=>{window.qaFailure=false;});
      await page.getByRole('button',{name:label}).click();
      await page.getByRole('status').filter({hasText:lang==='ar'?'لا توجد':'No pending'}).waitFor();
      assert.deepEqual(await page.evaluate(()=>window.qaRequests),[{auditId:'request-000000001'},{auditId:'request-000000001'}]);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    } finally {await page.close();}
  }
});
test('role changes require confirmation, cancellation makes no request, self changes disabled', async () => {
  const page = await pageFor({ mode: 'role' });
  try {
    await page.getByRole('combobox').click(); await page.getByRole('option', { name: 'Admin', exact: true }).click();
    await page.getByRole('alertdialog').waitFor();
    assert.equal((await page.evaluate(() => window.qaRequests)).length, 0);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal((await page.evaluate(() => window.qaRequests)).length, 0);
    await page.getByRole('combobox').click(); await page.getByRole('option', { name: 'Admin', exact: true }).click();
    await page.evaluate(() => { window.qaFailure = true; });
    await page.getByRole('button', { name: 'Confirm change', exact: true }).click();
    await page.waitForFunction(() => window.qaToasts.length === 1);
    assert.equal(await page.getByRole('alertdialog').count(), 1);
    assert.equal(await page.evaluate(() => window.qaToasts[0].variant), 'destructive');
    await page.evaluate(() => { window.qaFailure = false; });
    await page.getByRole('button', { name: 'Confirm change', exact: true }).click();
    await page.getByRole('alertdialog').waitFor({ state: 'hidden' });
    assert.equal((await page.evaluate(() => window.qaRequests)).length, 2);
  } finally { await page.close(); }
  const self = await pageFor({ mode: 'role', self: true, lang: 'ar' });
  try { await self.getByRole('combobox').waitFor(); assert.equal(await self.getByRole('combobox').isDisabled(), true); }
  finally { await self.close(); }
});
