import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const CUSTOMER_HOSTS = new Set(['meedex.com.ng', 'www.meedex.com.ng']);
const STAFF_HOST = 'staff.meedex.com.ng';

function hostnameOf(request: NextRequest) {
  return request.headers.get('host')?.split(':')[0]?.toLowerCase() ?? '';
}

function isLocalOrPreview(host: string) {
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.vercel.app');
}

function isStaffPage(pathname: string) {
  return (
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname === '/pos' ||
    pathname.startsWith('/pos/') ||
    pathname === '/finance' ||
    pathname.startsWith('/finance/') ||
    pathname === '/online-orders' ||
    pathname.startsWith('/online-orders/') ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/')
  );
}

function isStaffApi(pathname: string) {
  return (
    pathname === '/api/login' ||
    pathname.startsWith('/api/login/') ||
    pathname === '/api/staff' ||
    pathname.startsWith('/api/staff/') ||
    pathname === '/api/orders' ||
    pathname.startsWith('/api/orders/')
  );
}

function notFound() {
  return new NextResponse('Not Found', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

export function proxy(request: NextRequest) {
  const host = hostnameOf(request);
  const { pathname } = request.nextUrl;

  // Localhost and Vercel preview: same routes as today, plus /pos → POS.
  if (isLocalOrPreview(host)) {
    if (pathname === '/pos' || pathname.startsWith('/pos/')) {
      return NextResponse.rewrite(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  if (CUSTOMER_HOSTS.has(host)) {
    if (pathname === '/' || pathname === '') {
      return NextResponse.rewrite(new URL('/store', request.url));
    }
    if (isStaffPage(pathname) || isStaffApi(pathname)) {
      return notFound();
    }
    return NextResponse.next();
  }

  if (host === STAFF_HOST) {
    if (pathname === '/' || pathname === '') {
      return NextResponse.rewrite(new URL('/login', request.url));
    }
    if (pathname === '/pos' || pathname.startsWith('/pos/')) {
      return NextResponse.rewrite(new URL('/', request.url));
    }
    if (pathname === '/store' || pathname.startsWith('/store/')) {
      return notFound();
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on pages and APIs, but never on Next internals or static assets
    // (CSS, JS chunks, images, fonts, favicon).
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|txt)$).*)',
  ],
};
