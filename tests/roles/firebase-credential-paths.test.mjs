import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const root=new URL('../../src/',import.meta.url);
const discovery=[];
for(const file of await readdir(root,{recursive:true})){
  if(!file.endsWith('.ts'))continue;
  const source=await readFile(new URL(file.replaceAll('\\','/'),root),'utf8');
  if(source.includes('serviceAccount.local.json'))discovery.push({file,source});
}
const compile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const levels=['','..','../..','../../..','../../../..'];

test('all credential discovery paths retain existing order on Windows and Vercel',()=>{
  assert.equal(discovery.length,16);
  for(const {file,source} of discovery)for(const paths of [path.win32,path.posix]){
    const cwd=paths===path.win32?'C:\\academy\\app':'/academy/app';
    for(const explicit of [undefined,'custom-service-account.json',paths.join(cwd,'config','serviceAccount.local.json')]){
      if(file.replaceAll('\\','/')==='server/firebase-admin.ts'){
        const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
        const fn=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='getServiceAccountPaths');
        const get=new Function('path','process','clean',compile(fn.getText())+'; return getServiceAccountPaths();');
        const actual=get(paths,{cwd:()=>cwd,env:{FIREBASE_SERVICE_ACCOUNT_PATH:explicit}},v=>v?.trim());
        const expected=[...new Set([...(explicit?[paths.resolve(cwd,explicit)]:[]),...levels.map(level=>paths.resolve(cwd,level,'config','serviceAccount.local.json'))])];
        assert.deepEqual(actual,expected,file);
      }else{
        const fragment=source.match(/const tryPaths: string\[\] = \[[\s\S]*?\];\s*if \(explicitPath\) tryPaths\.unshift\(explicitPath\);/)?.[0];
        assert.ok(fragment,file);
        const actual=new Function('path','process','explicitPath',compile(fragment)+'; return tryPaths;')(paths,{cwd:()=>cwd},explicit);
        assert.deepEqual(actual,[...(explicit?[explicit]:[]),...levels.map(level=>paths.join(cwd,level,'config','serviceAccount.local.json'))],file);
      }
    }
  }
});

test('credential filenames are resolved from literal segments, not recursive wildcard-producing loop variables',()=>{
  for(const {file,source} of discovery){
    const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
    let checked=0;
    function visit(node){
      if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&
        ['join','resolve'].includes(node.expression.name.text)&&node.arguments.some(arg=>ts.isStringLiteral(arg)&&arg.text==='serviceAccount.local.json')){
        assert.equal(node.arguments[0].getText(ast),'process.cwd()',file);
        for(const arg of node.arguments.slice(1))assert.ok(ts.isStringLiteral(arg),file+': '+arg.getText(ast));
        checked++;
      }
      ts.forEachChild(node,visit);
    }
    visit(ast);assert.equal(checked,5,file);
  }
});
