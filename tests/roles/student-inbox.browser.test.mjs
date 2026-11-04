import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';
const root = fileURLToPath(new URL('../../', import.meta.url));
test('guest assignment confirmation, private question and admin reply, EN/AR mobile', async () => {
  const mocks = { '@/firebase': `export const useUser=()=>({user:{getIdToken:async()=>'admin'}});`, '@/components/i18n/lang': `export const useLang=()=>({lang:location.search.includes('ar')?'ar':'en',dir:location.search.includes('ar')?'rtl':'ltr'});` };
  const bundle = await build({ absWorkingDir:root,bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',alias:{'@':path.join(root,'src')},define:{'process.env.NODE_ENV':'"production"'},stdin:{resolveDir:root,loader:'jsx',contents:`import React from'react';import{createRoot}from'react-dom/client';import{StudentInbox,SubmissionStatus}from'./src/components/student-inbox';import{AdminStudentInbox}from'./src/components/admin-student-inbox';createRoot(document.getElementById('root')).render(location.pathname==='/admin'?<AdminStudentInbox/>:location.pathname==='/submission-status'?<SubmissionStatus/>:<StudentInbox courseId="number-systems"/>);`},plugins:[{name:'mock',setup(b){b.onResolve({filter:/.*/},a=>a.path in mocks?{path:a.path,namespace:'mock'}:null);b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js'}));}}] });
  const entries = new Map(); const errors=[]; let failOnce = true;
  const server=createServer(async(req,res)=>{ if(req.url.startsWith('/api/student-inbox')){res.setHeader('Content-Type','application/json');let text='';for await(const chunk of req)text+=chunk;const data=text?JSON.parse(text):{};
    if(req.method==='GET'){assert.equal(req.headers.authorization,'Bearer admin');res.end(JSON.stringify({items:[...entries.values()],next:null}));return;}
    if(req.method==='PATCH'){assert.equal(req.headers.authorization,'Bearer admin');const item=[...entries.values()].find(x=>x.id===data.id);Object.assign(item,{reply:data.reply,status:data.status,revision:item.revision+1});res.end('{}');return;}
    if(data.action==='status'){const item=entries.get(data.token);res.statusCode=item?200:404;res.end(JSON.stringify(item||{}));return;}
    if(failOnce){failOnce=false;res.statusCode=503;res.end('{}');return;}
    if(!entries.has(data.token))entries.set(data.token,{...data,id:String(entries.size+1),status:'under_review',revision:0,reply:'',createdAt:new Date().toISOString(),hasFile:!!data.file});res.statusCode=201;res.end(JSON.stringify(entries.get(data.token)));return;}
    res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<meta name="viewport" content="width=device-width"><div id="root"></div><script>'+bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
  try{browser=await chromium.launch({headless:true,...(process.env.INTERACTIVE_TEST_BROWSER?{executablePath:process.env.INTERACTIVE_TEST_BROWSER}:{})});const page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>errors.push(e.message));const origin='http://127.0.0.1:'+server.address().port;
    await page.goto(origin);await page.getByLabel('Assignment / lesson title').fill('QA assignment');await page.getByLabel('PDF, PNG or JPEG — maximum 2 MB').setInputFiles({name:'test.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-test')});await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Send privately',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(await page.getByText('Received successfully').count(),0);await page.getByRole('button',{name:'Retry same submission'}).click();await page.getByText('Received successfully').waitFor();assert.equal(entries.size,1);const receipt=await page.getByRole('link').getAttribute('href');assert.match(receipt,/#\w{64}$/);
    await page.goto(origin+'/admin');await page.getByRole('button',{name:'Load / refresh inbox'}).click();await page.getByRole('heading',{name:'QA assignment'}).waitFor();await page.getByLabel('Private reply').fill('Good work!');await page.getByLabel('Status',{exact:true}).selectOption('reviewed');await page.getByRole('button',{name:'Save reply and status'}).click();await page.getByText('Reply and status saved.').waitFor();
    await page.goto(receipt);await page.getByRole('button',{name:'Check status and reply'}).click();await page.getByText('Good work!').waitFor();await page.getByText('Reviewed',{exact:true}).waitFor();
    await page.goto(origin+'/?ar');await page.getByLabel('أريد',{exact:true}).selectOption('question');await page.getByLabel('عنوان الواجب / الدرس').fill('سؤال عن الدرس');await page.getByLabel('السؤال أو الملاحظة').fill('كيف نحول العدد؟');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'إرسال خاص',exact:true}).click();await page.getByText('تم الاستلام بنجاح').waitFor();await page.getByText('قيد المراجعة',{exact:true}).waitFor();assert.equal(entries.size,2);assert.equal(await page.locator('section').getAttribute('dir'),'rtl');assert.deepEqual(errors,[]);
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
});
