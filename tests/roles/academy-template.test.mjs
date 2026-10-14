import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const config = JSON.parse(readFileSync(new URL('../../academy.config.json', import.meta.url), 'utf8'));
function load(file, mocks = {}) {
  const code = ts.transpileModule(readFileSync(new URL('../../' + file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('require','module','exports',code)(name => mocks[name] ?? require(name), module, module.exports);
  return module.exports;
}
const { academySchema } = load('src/lib/academy-schema.ts');
test('deployment identity validates without secrets or unsafe values', () => {
  assert.equal(academySchema.safeParse(config).success, true);
  for (const patch of [{ siteUrl: 'javascript:alert(1)' }, { logoPath: '//evil.example/logo' }, { logoPath: '/../private' },
    { accentLight: '0 0% 0%;background:url(x)' }, { defaultLanguage: 'xx' }, { privateKey: 'never allowed' }, { features: { journal: true } }]) {
    assert.equal(academySchema.safeParse({ ...config, ...patch }).success, false, JSON.stringify(patch));
  }
});
test('a second academy config does not require CloudAI identity', () => {
  const other = { ...config, name: 'Example Academy', siteUrl: 'https://academy.example.org',
    contactEmail: 'hello@example.org', certificatePrefix: 'EX', meetingPrefix: 'Example', defaultLanguage: 'ar' };
  assert.equal(academySchema.safeParse(other).success, true);
});
test('disabled modules reject their direct page and API paths but preserve reconciliation', () => {
  const disabled = { ...config, features: Object.fromEntries(Object.keys(config.features).map(key => [key, false])) };
  const policy = load('src/lib/academy.ts', { '../../academy.config.json': disabled });
  for (const path of ['/journal', '/journal/submit', '/admin/journal', '/api/journal/articles', '/reviewer', '/api/reviewer/assignments',
    '/research', '/live/room', '/certificates', '/api/certificates/list', '/learning-path', '/dashboard/telegram', '/teacher/telegram', '/api/telegram/jobs/create', '/api/billing/course-checkout']) {
    assert.equal(policy.academyPathEnabled(path), false, path);
  }
  for (const path of ['/profile', '/courses', '/admin/academy', '/journal-other', '/api/billing/webhook', '/api/billing/course-confirm', '/api/billing/portal']) {
    assert.equal(policy.academyPathEnabled(path), true, path);
  }
  const { middleware } = load('src/middleware.ts', {
    '@/lib/academy': policy,
    '@/lib/security-headers': load('src/lib/security-headers.ts'),
    'next/server': { NextResponse: class extends Response {
      static next() { return new Response(null, { status: 200 }); }
      static json(data, options) { return Response.json(data, options); }
    } },
  });
  assert.equal(middleware({ nextUrl: { pathname: '/api/journal/articles' } }).status, 404);
  assert.equal(middleware({ nextUrl: { pathname: '/journal' } }).status, 404);
  assert.equal(middleware({ nextUrl: { pathname: '/courses' } }).status, 200);
});

test('middleware overwrites spoofed security headers, rotates nonces and supports staged enforcement', () => {
  let forwarded;
  const { middleware } = load('src/middleware.ts', {
    '@/lib/academy': {academy:config, academyPathEnabled:()=>true},
    '@/lib/security-headers': load('src/lib/security-headers.ts'),
    'next/server': {NextResponse:class extends Response {
      static next(options) {forwarded=options.request.headers;return new Response(null);}
    }},
  });
  const oldMode=process.env.CSP_MODE;
  try {
    process.env.CSP_MODE='report-only';
    const request={nextUrl:{pathname:'/'},headers:new Headers({'x-nonce':'attacker','Content-Security-Policy':"script-src *",'Content-Security-Policy-Report-Only':'attacker'})};
    const first=middleware(request);
    const firstNonce=forwarded.get('x-nonce');
    assert.equal(Buffer.from(firstNonce,'base64').length,32);
    assert.notEqual(firstNonce,'attacker');
    assert.equal(forwarded.get('Content-Security-Policy-Report-Only'),forwarded.get('Content-Security-Policy'));
    assert.equal(first.headers.get('Content-Security-Policy-Report-Only'),forwarded.get('Content-Security-Policy'));
    assert.equal(first.headers.get('Content-Security-Policy'),null);
    assert.equal(load('src/lib/security-headers.ts').globalSecurityHeaders.find(header=>header.key==='Content-Security-Policy').value,"frame-ancestors 'self'; object-src 'none'; base-uri 'self'");
    assert.equal(first.headers.get('Cache-Control'),'private, no-store');
    process.env.CSP_MODE='enforce';
    const second=middleware(request);
    assert.notEqual(forwarded.get('x-nonce'),firstNonce);
    assert.equal(second.headers.get('Content-Security-Policy-Report-Only'),null);
    assert.equal(second.headers.get('Content-Security-Policy'),forwarded.get('Content-Security-Policy'));
  } finally {if(oldMode===undefined)delete process.env.CSP_MODE;else process.env.CSP_MODE=oldMode;}
});
