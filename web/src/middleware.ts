import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const isAuthenticated = !!req.auth;
  const { pathname } = req.nextUrl;
  const isPublicPage = pathname === '/teacher/login' || pathname === '/teacher/register';

  if (!isAuthenticated && !isPublicPage) {
    return NextResponse.redirect(new URL('/teacher/login', req.url));
  }
  if (isAuthenticated && isPublicPage) {
    return NextResponse.redirect(new URL('/teacher', req.url));
  }
});

export const config = { matcher: ['/teacher/:path*'] };
