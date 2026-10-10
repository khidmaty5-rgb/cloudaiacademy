import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { chromium } from 'playwright';
const require = createRequire(import.meta.url);
async function load(path, mocks = {}) {
  const code = ts.transpileModule(await readFile(new URL('../../' + path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop:true },
  }).outputText;
  const module = { exports:{} };
  new Function('require','module','exports',code)(name => mocks[name] ?? require(name),module,module.exports);
  return module.exports;
}
const policy = await load('src/lib/interactive-lesson.ts');
const pkg = await load('src/lib/lesson-package.ts');
const parser = await load('src/lib/parse-interactive-zip.ts', { './lesson-package':pkg });
const { InteractiveLessonPlayer } = await load('src/components/learn/interactive-lesson-player.tsx', {
  '@/lib/interactive-lesson':policy,
  '@/components/i18n/lang':{ useLang:() => ({ lang:'en' }) },
  '@/components/ui/button':{ Button:({ children,onClick }) => React.createElement('button',{onClick},children) },
});
let browser, server, origin, fixture = '', probes = 0;
before(async () => {
  server = createServer((req,res) => {
    if (req.url === '/probe') { probes++; res.end('network request'); return; }
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Set-Cookie','academy_session=private-session; SameSite=Strict');
    res.end('<!doctype html><style>body{margin:0} iframe{width:100%;height:700px}</style><p id="academy-secret">private-parent</p><script>localStorage.setItem("academy-token","private-token")</script>' + fixture);
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ headless:true, ...(process.env.INTERACTIVE_TEST_BROWSER ? {executablePath:process.env.INTERACTIVE_TEST_BROWSER} : {}) });
});
after(async () => { await browser?.close(); if(server) await new Promise(resolve => server.close(resolve)); });
function render(html) { fixture = renderToStaticMarkup(React.createElement(InteractiveLessonPlayer,{html,title:'Interactive test'})); }
test('original scripts run while parent, cookies, storage, navigation and requests remain blocked', async () => {
  render(`<style>body{background:rgb(7,13,27)}</style><button id="quiz" onclick="this.textContent='Score: 1'">Check quiz</button><svg><circle id="animated" r="4"><animateMotion dur="1s" path="M0 0 L50 50" repeatCount="indefinite"/></circle></svg><pre id="result"></pre><script>
    const result={origin:window.origin};
    try { result.parent=parent.document.getElementById('academy-secret').textContent; } catch { result.parent='blocked'; }
    try { result.cookies=document.cookie; } catch { result.cookies='blocked'; }
    try { result.storage=localStorage.getItem('academy-token'); } catch { result.storage='blocked'; }
    try { top.location.href='${origin}/probe'; result.top='allowed'; } catch { result.top='blocked'; }
    fetch('${origin}/probe').then(()=>result.network='allowed').catch(()=>result.network='blocked').finally(()=>document.getElementById('result').textContent=JSON.stringify(result));
  </script>`);
  const page = await browser.newPage();
  try {
    await page.goto(origin);
    const frame = page.frameLocator('iframe');
    await frame.locator('#quiz').click();
    assert.equal(await frame.locator('#quiz').textContent(),'Score: 1');
    await frame.locator('#result').filter({hasText:'network'}).waitFor();
    const results = JSON.parse(await frame.locator('#result').textContent());
    assert.deepEqual(results,{origin:'null',parent:'blocked',cookies:'blocked',storage:'blocked',top:'blocked',network:'blocked'});
    assert.equal(probes,0);
    assert.equal(page.url(),origin + '/');
    assert.equal(await frame.locator('body').evaluate(node=>getComputedStyle(node).backgroundColor),'rgb(7, 13, 27)');
    assert.ok(await frame.locator('#animated').evaluate(node=>node.getCTM().e !== 0 || node.getCTM().f !== 0));
  } finally { await page.close(); }
});
test('uploaded Tailscale sample retains simulator, quiz, dark theme and mobile layout', {skip:!process.env.INTERACTIVE_SAMPLE_HTML}, async () => {
  const html = await readFile(process.env.INTERACTIVE_SAMPLE_HTML,'utf8');
  render(parser.parseInteractiveHtml(html,'index.html').lessons[0].interactiveHtml);
  const page = await browser.newPage({ viewport:{width:1280,height:900} });
  try {
    await page.goto(origin);
    const frame = page.frameLocator('iframe');
    await frame.locator('#relayBtn').click();
    assert.match(await frame.locator('#pathState').textContent(),/relay/i);
    await frame.locator('#directBtn').click();
    assert.match(await frame.locator('#pathState').textContent(),/direct/i);
    for (const [index,value] of [1,1,1,0,2].entries()) await frame.locator(`input[name="q${index}"][value="${value}"]`).check();
    await frame.getByRole('button',{name:/check answers/i}).click();
    assert.equal(await frame.locator('#score').textContent(),'Score: 5 / 5');
    assert.equal(await frame.locator('#visualDirect').evaluate(node=>getComputedStyle(node).animationName),'routeMove');
    await page.setViewportSize({width:390,height:844});
    assert.ok(await frame.locator('body').evaluate(node=>node.scrollWidth <= innerWidth + 1));
    await frame.locator('header').scrollIntoViewIfNeeded();
    if (process.env.INTERACTIVE_SCREENSHOT) await page.screenshot({path:process.env.INTERACTIVE_SCREENSHOT});
  } finally { await page.close(); }
});
