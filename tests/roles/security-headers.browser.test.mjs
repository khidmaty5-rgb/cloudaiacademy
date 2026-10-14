import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { chromium } from 'playwright';
import { security } from './security-headers.test.mjs';
test('enforced policy blocks unauthorized parent scripts and identifies inherited data-frame restriction', async () => {
  const nonce='YWJjZGVmZ2hpamtsbW5vcA==';
  const frame='data:text/html,'+encodeURIComponent('<button id="quiz" onclick="this.textContent=\'passed\'">quiz</button><script>window.loaded=true</script>');
  const server=createServer((req,res)=>{
    res.setHeader('Content-Type','text/html');
    res.setHeader('Content-Security-Policy',security.contentSecurityPolicy(nonce, {}));
    res.end(`<body><script nonce="${nonce}">window.approved=true;const s=document.createElement('script');s.textContent='window.trustedChild=true';document.body.append(s);</script><script>window.unapproved=true</script><button id="unauthorized" onclick="window.handler=true">Untrusted handler</button><script type="application/ld+json" nonce="${nonce}">${security.serializeJsonLd({title:'</script><script>window.breakout=true</script>'})}</script><iframe sandbox="allow-scripts" src="${frame}"></iframe>`);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await chromium.launch({headless:true,...(process.env.INTERACTIVE_TEST_BROWSER?{executablePath:process.env.INTERACTIVE_TEST_BROWSER}:{})});
    const page=await browser.newPage();
    await page.goto('http://127.0.0.1:'+server.address().port);
    assert.equal(await page.evaluate(()=>window.approved),true);
    assert.equal(await page.evaluate(()=>window.unapproved),undefined);
    assert.equal(await page.evaluate(()=>window.breakout),undefined);
    // strict-dynamic deliberately delegates trust to the approved loader.
    assert.equal(await page.evaluate(()=>window.trustedChild),true);
    await page.locator('#unauthorized').click();
    assert.equal(await page.evaluate(()=>window.handler),undefined);
    const child=page.frames().find(frame=>frame!==page.mainFrame());
    assert.equal(await child.evaluate(()=>window.loaded),undefined);
    await child.locator('#quiz').click();
    assert.equal(await child.locator('#quiz').textContent(),'quiz');
    assert.equal(await child.evaluate(()=>location.origin),'null');
  } finally { await browser?.close(); await new Promise(resolve=>server.close(resolve)); }
});

test('initial Report-Only preserves existing interactive course scripts and emits violations', async () => {
  const frame='data:text/html,'+encodeURIComponent('<script>window.loaded=true</script>');
  const server=createServer((req,res)=>{
    res.setHeader('Content-Type','text/html');
    res.setHeader('Content-Security-Policy-Report-Only',security.contentSecurityPolicy('YWJjZA==', {}));
    res.end(`<script>window.unapproved=true</script><iframe sandbox="allow-scripts" src="${frame}"></iframe>`);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await chromium.launch({headless:true,...(process.env.INTERACTIVE_TEST_BROWSER?{executablePath:process.env.INTERACTIVE_TEST_BROWSER}:{})});
    const page=await browser.newPage();
    const messages=[]; page.on('console',message=>messages.push(message.text()));
    await page.goto('http://127.0.0.1:'+server.address().port);
    assert.equal(await page.evaluate(()=>window.unapproved),true);
    assert.equal(await page.frames()[1].evaluate(()=>window.loaded),true);
    assert.ok(messages.some(message=>/report-only/i.test(message)));
  } finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
});
