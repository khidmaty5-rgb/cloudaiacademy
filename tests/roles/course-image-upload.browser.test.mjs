import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { chromium } from 'playwright';

test('course cover decodes, resizes and persists as a bounded raster; invalid files fail', async () => {
  const source = await readFile(new URL('../../src/lib/course-image-upload.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText;
  const browser = await chromium.launch({headless:true, ...(process.env.INTERACTIVE_TEST_BROWSER ? {executablePath:process.env.INTERACTIVE_TEST_BROWSER} : {})});
  try {
    const page = await browser.newPage();
    const result = await page.evaluate(async code => {
      const module = await import(URL.createObjectURL(new Blob([code], {type:'text/javascript'})));
      const canvas = document.createElement('canvas'); canvas.width=1600; canvas.height=900;
      const ctx=canvas.getContext('2d'); ctx.fillStyle='orange'; ctx.fillRect(0,0,1600,900);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      const image=await module.prepareCourseImage(new File([blob],'cover.png',{type:'image/png'}));
      const restored=JSON.parse(JSON.stringify({imageUrl:image}));
      const img=new Image(); img.src=restored.imageUrl; await img.decode();
      const rejected=[];
      for(const file of [new File(['<svg/>'],'bad.svg',{type:'image/svg+xml'}),new File(['broken'],'broken.png',{type:'image/png'}),new File([new Uint8Array(8*1024*1024+1)],'big.jpg',{type:'image/jpeg'})]) {
        try { await module.prepareCourseImage(file); rejected.push(false); } catch { rejected.push(true); }
      }
      return {valid:module.isCourseImageData(image),size:image.length,width:img.naturalWidth,height:img.naturalHeight,rejected,svgAccepted:module.isCourseImageData('data:image/svg+xml;base64,PHN2Zy8+')};
    },code);
    assert.equal(result.valid,true); assert.ok(result.size<=128*1024);
    assert.equal(result.width,960); assert.equal(result.height,540);
    assert.deepEqual(result.rejected,[true,true,true]); assert.equal(result.svgAccepted,false);
  } finally { await browser.close(); }
});
