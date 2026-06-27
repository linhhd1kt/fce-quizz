import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const isAuthenticated = !!req.auth;
  const { pathname } = req.nextUrl;
  const isLoginPage = pathname === '/teacher/login';

  if (!isAuthenticated && !isLoginPage) {
    return NextResponse.redirect(new URL('/teacher/login', req.url));
  }
  if (isAuthenticated && isLoginPage) {
    return NextResponse.redirect(new URL('/teacher', req.url));
  }
});

export const config = { matcher: ['/teacher/:path*'] };
