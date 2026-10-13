import assert from 'node:assert/strict';
import {test} from 'node:test';
import {chromium} from 'playwright';
const base=process.env.ACADEMY_SMOKE_BASE_URL;
const enforced=process.env.ACADEMY_SMOKE_CSP_MODE==='enforce';
if(base){const url=new URL(base);if(url.hostname!=='127.0.0.1'||url.protocol!=='http:')throw Error('Local production test server required');}

test('built production HTML and middleware agree on fresh nonces and security headers',{skip:!base},async()=>{
  const first=await fetch(base);const second=await fetch(base);
  assert.equal(first.status,200);assert.equal(second.status,200);
  for(const response of [first,second]){
    assert.equal(response.headers.get('x-content-type-options'),'nosniff');
    assert.equal(response.headers.get('x-frame-options'),'SAMEORIGIN');
    assert.equal(response.headers.get('referrer-policy'),'strict-origin-when-cross-origin');
    assert.ok(response.headers.get('permissions-policy'));
  }
  const nonce=response=>response.headers.get(enforced?'content-security-policy':'content-security-policy-report-only')?.match(/'nonce-([^']+)'/)?.[1];
  if(enforced)assert.equal(first.headers.get('content-security-policy-report-only'),null);
  const firstNonce=nonce(first);assert.ok(firstNonce);assert.notEqual(firstNonce,nonce(second));
  const html=await first.text();const tags=[...html.matchAll(/<script\b([^>]*)>/gi)];
  assert.ok(tags.length>0);
  for(const tag of tags)assert.ok(tag[1].includes(`nonce="${firstNonce}"`),'Every built script must carry the response nonce');
  assert.ok(html.includes('theme-init'));assert.ok(html.includes('lang-dir-init'));
  assert.equal((await fetch(base+'/api/courses/business-intelligence/lesson-imports')).status,401);
});

test('full enforced policy blocks a parser-inserted inline script in an inherited test frame',{skip:!base||!enforced},async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.INTERACTIVE_TEST_BROWSER?{executablePath:process.env.INTERACTIVE_TEST_BROWSER}:{})});
  try{
    const page=await browser.newPage();
    await page.goto(base+'/login');
    await page.evaluate(()=>{
      window.__academyProbeReady=false;
      const frame=document.createElement('iframe');
      frame.onload=()=>{window.__academyProbeFlag=frame.contentWindow.__academyProbeFlag;window.__academyProbeReady=true;};
      frame.srcdoc='<script>window.__academyProbeFlag=true</script>';
      document.body.appendChild(frame);
    });
    await page.waitForFunction(()=>window.__academyProbeReady===true);
    assert.equal(await page.evaluate(()=>window.__academyProbeFlag),undefined);
  }finally{await browser.close();}
});

test('built app hydrates Arabic/dark preferences and redirects signed-out protected entry',{skip:!base},async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.INTERACTIVE_TEST_BROWSER?{executablePath:process.env.INTERACTIVE_TEST_BROWSER}:{})});
  try{
    const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    // No real account/session or outbound cloud writes in this isolated context.
    await page.route('**/*',route=>{
      const request=route.request();
      return request.url().startsWith(base+'/')&&['GET','HEAD'].includes(request.method())?route.continue():route.abort();
    });
    await page.addInitScript(()=>{localStorage.setItem('theme','dark');localStorage.setItem('appLang','ar');});
    await page.goto(base+'/login');
    await page.waitForFunction(()=>document.documentElement.lang==='ar'&&document.documentElement.dir==='rtl'&&document.documentElement.classList.contains('dark'));
    await page.goto(base+'/teacher/telegram');
    await page.waitForURL(url=>url.pathname==='/login');
    assert.ok(!errors.some(message=>/hydration|Minified React|Application error/i.test(message)));
  }finally{await browser.close();}
});
