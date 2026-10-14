import { NextResponse, type NextRequest } from 'next/server';
import { academyPathEnabled } from '@/lib/academy';
import { academy } from '@/lib/academy';
import { contentSecurityPolicy } from '@/lib/security-headers';

export function middleware(request: NextRequest) {
  // 256 random bits per request. Never trust a client-supplied nonce/CSP header.
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
  const policy = contentSecurityPolicy(nonce, {
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    analyticsUrl: process.env.NEXT_PUBLIC_EVIDENCE_BASE_URL || academy.analyticsUrl,
    // Exact deployment-specific S3/presigned upload and PDF origins, not *.amazonaws.com.
    storageOrigins: (process.env.CSP_STORAGE_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean),
  }, process.env.NODE_ENV !== 'production');
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  // Next parses this request header to nonce its framework/hydration scripts,
  // even when the browser-facing policy is initially Report-Only.
  headers.set('Content-Security-Policy', policy);
  // Next also parses Report-Only. Forward the same server-generated policy in
  // both names for production adapters that strip CSP from internal requests.
  // Replace both client values; never use an incoming nonce/policy as a fallback.
  headers.set('Content-Security-Policy-Report-Only', policy);
  let response: NextResponse;
  if (academyPathEnabled(request.nextUrl.pathname)) {
    response = NextResponse.next({ request: { headers } });
  } else if (request.nextUrl.pathname.startsWith('/api/')) {
    response = NextResponse.json({ error: 'FEATURE_DISABLED' }, { status: 404 });
  } else {
    response = new NextResponse('This module is not available for this academy. / هذه الوحدة غير متاحة لهذه الأكاديمية.', {
      status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  response.headers.set(process.env.CSP_MODE === 'enforce' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only', policy);
  // Request-specific nonces must never be replayed by a shared HTML cache.
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
