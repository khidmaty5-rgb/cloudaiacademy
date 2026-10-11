import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {zipSync,strToU8} from 'fflate';
const root=fileURLToPath(new URL('../../',import.meta.url));
const mocks={
  '@/firebase':`import {useMemo} from 'react';export const useMemoFirebase=(fn,deps)=>useMemo(fn,deps);export const useCollection=()=>({data:[],isLoading:false});`,
  'firebase/firestore':`const db={};export const getFirestore=()=>db;export const collection=()=>({});export const query=()=>({});export const where=()=>({});`,
  'firebase/auth':`export const getAuth=()=>({currentUser:{getIdToken:async()=>'test-token'}});`,
  '@/hooks/useCurrentRole':`export const useCurrentRole=()=>({isAdmin:true,role:'admin',loading:false});`,
  './editor-copy':`export const useEditorCopy=()=>({t:value=>value,lang:'en'});`,
  '@/components/i18n/lang':`export const useLang=()=>({lang:'en'});`,
  '@/hooks/use-toast':`export const useToast=()=>({toast:()=>{}});`,
  'next/navigation':`export const useRouter=()=>({push:path=>window.qaNavigate(path),refresh:()=>{}});`,
  '@/lib/courses':`export const addCourse=async(data)=>{window.qaCreates=(window.qaCreates||0)+1;window.qaCourse=data;return{id:'tailscale',slug:'tailscale'}};export const updateCourse=async(id,data)=>{window.qaUpdates=(window.qaUpdates||0)+1;window.qaCourse=data};`,
};
let browser,server,origin,bundle,draft,saveAttempts;
before(async()=>{
  const result=await build({absWorkingDir:root,bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},alias:{'@':path.join(root,'src')},
    stdin:{resolveDir:root,loader:'jsx',contents:`import React from 'react';import{createRoot}from'react-dom/client';import CourseForm from './src/components/admin/CourseForm';import LessonZipImport from './src/components/admin/LessonZipImport';const root=createRoot(document.getElementById('root'));window.qaNavigate=path=>{history.pushState({},'',path);root.render(<LessonZipImport courseId="tailscale"/>)};root.render(<CourseForm/>);`},
    plugins:[{name:'test-services',setup(builder){builder.onResolve({filter:/.*/},args=>args.path in mocks?{path:args.path,namespace:'test-services'}:null);builder.onLoad({filter:/.*/,namespace:'test-services'},args=>({contents:mocks[args.path],loader:'js',resolveDir:root}));}}]});
  bundle=result.outputFiles[0].text;
  server=createServer(async(req,res)=>{
    if(req.url.startsWith('/api/courses/tailscale/lesson-imports')){
      res.setHeader('Content-Type','application/json');
      if(req.method==='POST'){
        let body='';for await(const chunk of req)body+=chunk;
        const data=JSON.parse(body);
        if(++saveAttempts===1){res.statusCode=500;res.end('{"error":"IMPORT_FAILED"}');return;}
        draft=data;res.end(JSON.stringify({id:data.importId,status:'DRAFT'}));return;
      }
      res.end(JSON.stringify({...draft,status:'DRAFT'}));return;
    }
    res.setHeader('Content-Type','text/html');res.end('<!doctype html><div id="root"></div><script>'+bundle.replace(/<\/script/gi,'<\\/script')+'</script>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,...(process.env.INTERACTIVE_TEST_BROWSER?{executablePath:process.env.INTERACTIVE_TEST_BROWSER}:{})});
});
after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
test('ZIP upload fills details, respects typed price, retries without creating twice and opens the saved lesson',async()=>{
  draft=undefined;saveAttempts=0;
  const html='<title>Interactive course</title><h1>Tailscale: Practical Networking</h1><p class="lead">Build secure networks with practical WireGuard labs.</p><button id="quiz" onclick="this.textContent=\'Scored\'">Quiz</button>';
  const zip=zipSync({'index.html':strToU8(html),'course.json':strToU8(JSON.stringify({price:'99',level:'Intermediate',duration:'2 weeks',totalHours:6}))});
  const page=await browser.newPage();
  page.on('pageerror',error=>console.error('Course fixture:',error.message));
  try{
    await page.goto(origin);
    await page.getByLabel('Price',{exact:true}).fill('199');
    await page.getByLabel('Course ZIP or HTML file',{exact:true}).setInputFiles({name:'Tailscale.zip',mimeType:'application/zip',buffer:Buffer.from(zip)});
    await page.getByRole('status').filter({hasText:'lessons ready'}).waitFor();
    assert.equal(await page.getByLabel('Course Title',{exact:true}).inputValue(),'Tailscale: Practical Networking');
    assert.equal(await page.getByLabel('Course Description',{exact:true}).inputValue(),'Build secure networks with practical WireGuard labs.');
    assert.equal(await page.getByLabel('Category',{exact:true}).inputValue(),'Networking');
    assert.equal(await page.getByLabel('Price',{exact:true}).inputValue(),'199');
    assert.match(await page.getByLabel('Level',{exact:true}).textContent(),/Intermediate/);
    await page.getByRole('button',{name:'Create Course',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'retry'}).waitFor();
    assert.equal(await page.evaluate(()=>window.qaCreates),1);
    await page.getByRole('button',{name:'Retry lesson upload',exact:true}).click();
    await page.getByRole('dialog').waitFor();
    await page.getByRole('button',{name:'Review publication',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.qaCreates),1);assert.equal(await page.evaluate(()=>window.qaUpdates),1);
    assert.equal(draft.name,'Tailscale.zip');assert.equal(draft.lessons[0].interactiveHtml,html);
    assert.equal(await page.evaluate(()=>window.qaCourse.status),'DRAFT');
    await page.getByRole('button',{name:'Preview interactive lesson',exact:true}).click();
    const frame=page.frameLocator('iframe');await frame.locator('#quiz').click();assert.equal(await frame.locator('#quiz').textContent(),'Scored');
    assert.ok(!page.url().includes('lessonImport='));
  }finally{await page.close();}
});
