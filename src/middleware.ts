import { NextResponse, type NextRequest } from 'next/server';
import { academyPathEnabled } from '@/lib/academy';

export function middleware(request: NextRequest) {
  if (academyPathEnabled(request.nextUrl.pathname)) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'FEATURE_DISABLED' }, { status: 404 });
  }
  return new NextResponse('This module is not available for this academy. / هذه الوحدة غير متاحة لهذه الأكاديمية.', {
    status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
