import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { zipSync, strToU8 } from 'fflate';
const url = code => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
async function compile(path, replacements = {}) {
  let code = ts.transpileModule(await readFile(new URL('../../' + path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const [from,to] of Object.entries(replacements)) code = code.replaceAll(from,to);
  return url(code);
}
const pkgUrl = await compile('src/lib/lesson-package.ts');
const parserUrl = await compile('src/lib/parse-interactive-zip.ts', { './lesson-package':pkgUrl, fflate:import.meta.resolve('fflate'), htmlparser2:import.meta.resolve('htmlparser2') });
const { parseInteractiveHtml, parseInteractiveZip } = await import(parserUrl);
const { validatePackage } = await import(pkgUrl);
const zip = files => zipSync(Object.fromEntries(Object.entries(files).map(([key,value]) => [key,strToU8(value)])));
test('standalone lesson preserves CSS, inline event handlers, scripts and SVG animation', () => {
  const html = '<html><head><title>Interactive</title><style>@keyframes move{to{opacity:0}}</style></head><body><svg><circle><animateMotion dur="1s" path="M0 0 L30 30"/></circle></svg><button onclick="quiz()">Check</button><script>function quiz(){document.body.dataset.score=1}</script></body></html>';
  const result = parseInteractiveHtml(html);
  assert.equal(result.lessons[0].interactiveHtml, html);
  assert.deepEqual(result.lessons[0].nodes, []);
  assert.equal(validatePackage(result).lessons[0].interactiveHtml, html);
});
test('local JS/CSS/image/font dependencies are bundled without external requests', () => {
  const result = parseInteractiveZip(zip({
    'lesson/index.html':'<title>Bundled</title><link rel="stylesheet" href="../style.css"><img src="../image.svg"><script src="../logic.js"></script>',
    'style.css':'.diagram{background:url(image.svg)} @font-face{font-family:test;src:url(font.woff2)}',
    'logic.js':'window.score=42', 'image.svg':'<svg xmlns="http://www.w3.org/2000/svg"/>', 'font.woff2':'test-font',
  })).lessons[0].interactiveHtml;
  assert.match(result, /<script>window.score=42<\/script>/);
  assert.match(result, /data:image\/svg\+xml;base64,/);
  assert.match(result, /data:font\/woff2;base64,/);
  assert.doesNotMatch(result, /src="\.\.|href="\.\./);
});
test('archive and dependency errors fail before publication', () => {
  for (const name of ['../index.html','/index.html','a/../index.html','constructor/index.html']) assert.throws(() => parseInteractiveZip(zip({[name]:'<p>bad</p>'})), /UNSAFE_ARCHIVE_PATH/);
  assert.throws(() => parseInteractiveZip(zip({'a.html':'ok','A.html':'ok'})), /DUPLICATE_PATH/);
  assert.throws(() => parseInteractiveZip(zip({'a.html':'<p>ok</p>','run.exe':'unsafe'})), /UNSUPPORTED_ASSET/);
  assert.throws(() => parseInteractiveHtml('<script src="https://external.invalid/a.js"></script>'), /EXTERNAL_DEPENDENCY/);
  assert.throws(() => parseInteractiveHtml('<script src="missing.js"></script>'), /MISSING_ASSET/);
  assert.throws(() => parseInteractiveHtml('<style>@import "theme.css";</style>'), /INTERACTIVE_CSS_IMPORT/);
  assert.throws(() => parseInteractiveHtml('<script type="module">import x from "./x.js"</script>'), /INTERACTIVE_MODULE_IMPORT/);
  assert.throws(() => validatePackage({lessons:[{key:'l0',title:'Huge',nodes:[],interactiveHtml:'x'.repeat(650001)}]}), /CONTENT_TOO_LARGE/);
});
