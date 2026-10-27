import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';
const root=fileURLToPath(new URL('../../',import.meta.url));
test('admin draft/upload retry/publish/withdraw and signed-out English/Arabic resources',async()=>{
 const mocks={
  '@/firebase':`const user={getIdToken:async()=>'admin-test'};export const useUser=()=>({user:location.pathname==='/manage'?user:null});`,
  '@/components/i18n/lang':`export const useLang=()=>({lang:location.search.includes('ar')?'ar':'en',dir:location.search.includes('ar')?'rtl':'ltr'});`,
 };
 const result=await build({absWorkingDir:root,bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},alias:{'@':path.join(root,'src')},
  stdin:{resolveDir:root,loader:'jsx',contents:`import React from 'react';import{createRoot}from'react-dom/client';import Resources from './src/components/lecture-resources';createRoot(document.getElementById('root')).render(<Resources manage={location.pathname==='/manage'}/>);`},
  plugins:[{name:'fixture',setup(b){b.onResolve({filter:/.*/},a=>a.path in mocks?{path:a.path,namespace:'fixture'}:null);b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:mocks[a.path],loader:'js',resolveDir:root}));}}]});
 let items=[],attempts=0; const errors=[];
 const server=createServer(async(req,res)=>{
  if(req.url.startsWith('/api/lecture-resources')){
   res.setHeader('Content-Type','application/json');
   if(req.method==='POST'){for await(const _ of req){};if(++attempts===1){res.statusCode=503;res.end('{}');return;}items=[{id:'11111111-1111-4111-8111-111111111111',title:'Networking sheet',topic:'Networking',description:'QA sheet',published:false,size:128}];res.statusCode=201;res.end('{}');return;}
   if(req.method==='PATCH'){let body='';for await(const c of req)body+=c;const value=JSON.parse(body);items[0].published=value.published;res.end('{}');return;}
   res.end(JSON.stringify({items:req.url.includes('manage=1')?items:items.filter(x=>x.published),next:null}));return;
  }
  res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width"><div id="root"></div><script>'+result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script>');
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try {
  browser=await chromium.launch({headless:true,...(process.env.INTERACTIVE_TEST_BROWSER?{executablePath:process.env.INTERACTIVE_TEST_BROWSER}:{})});
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message)); const origin='http://127.0.0.1:'+server.address().port;
  await page.goto(origin+'/manage');await page.getByLabel('Title',{exact:true}).fill('Networking sheet');await page.getByLabel('PDF file — up to 3 MB').setInputFiles({name:'sheet.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7 test fixture')});
  await page.getByRole('button',{name:'Save private draft'}).click();await page.getByRole('alert').waitFor();assert.equal(items.length,0);
  await page.getByRole('button',{name:'Save private draft'}).click();await page.getByRole('button',{name:'Publish for everyone'}).waitFor();assert.equal(items[0].published,false);
  const guest=await browser.newPage({viewport:{width:390,height:844}});await guest.goto(origin+'/resources');await guest.getByText('No lecture sheets available yet.').waitFor();assert.equal(await guest.getByRole('button',{name:'Publish for everyone'}).count(),0);
  await page.getByRole('button',{name:'Publish for everyone'}).click();await page.getByRole('button',{name:'Withdraw',exact:true}).waitFor();
  await guest.reload();await guest.getByRole('link',{name:'Download PDF'}).waitFor();assert.match(await guest.getByRole('link',{name:'Download PDF'}).getAttribute('href'),/^\/api\/lecture-resources\/[^/]+\/download$/);
  await guest.goto(origin+'/resources?ar');await guest.getByRole('heading',{name:'أوراق المحاضرات'}).waitFor();await guest.getByRole('link',{name:'تنزيل PDF'}).waitFor();
  await page.getByRole('button',{name:'Withdraw',exact:true}).click();await page.getByRole('button',{name:'Publish for everyone'}).waitFor();await guest.reload();await guest.getByText('لا توجد أوراق محاضرات متاحة بعد.').waitFor();assert.deepEqual(errors,[]);
 } finally {await browser?.close();await new Promise(r=>server.close(r));}
});
