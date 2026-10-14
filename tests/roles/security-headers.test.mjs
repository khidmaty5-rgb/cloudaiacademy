import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../../src/lib/security-headers.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
export const security = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
test('production policy has nonce scripts, no inline scripts/eval or broad network wildcards', () => {
  const policy = security.contentSecurityPolicy('YWJjZA==', {authDomain:'test.firebaseapp.com',projectId:'test-project',storageOrigins:['https://bucket.s3.ca-central-1.amazonaws.com','javascript:bad','https://user:pass@bad.example']});
  assert.match(policy, /script-src 'self' 'nonce-YWJjZA==' 'strict-dynamic'; script-src-attr 'none'/);
  assert.ok(!policy.includes('unsafe-eval'));
  assert.ok(!policy.includes('*.'));
  assert.ok(!policy.includes('bad.example'));
  for (const directive of ['default-src','style-src','img-src','font-src','connect-src','frame-src','frame-ancestors','object-src','base-uri','form-action']) assert.ok(policy.includes(directive));
  assert.ok(!policy.includes('cloudfunctions.net'));
  assert.match(security.contentSecurityPolicy('YWJjZA==', {}, true), /unsafe-eval/);
  assert.throws(() => security.contentSecurityPolicy("evil'; script-src *", {}));
});
test('JSON-LD round-trips malicious article fields without HTML script breakouts', () => {
  const value = {headline:'</script><script>alert(1)</script>',description:'<!-- & \u2028 \u2029',author:[{name:'</ScRiPt><img src=x onerror=alert(1)>'}]};
  const serialized = security.serializeJsonLd(value);
  assert.ok(!/[<>&\u2028\u2029]/.test(serialized));
  assert.deepEqual(JSON.parse(serialized), value);
});
