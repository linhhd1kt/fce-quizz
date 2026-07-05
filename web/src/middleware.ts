import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const role = (req.auth as { user?: { role?: string } } | null)?.user?.role;

  // ── Home redirect for teacher ──────────────────────────────────────────────
  if (pathname === '/' && role === 'teacher') {
    return NextResponse.redirect(new URL('/teacher', req.url));
  }

  // ── Teacher routes ─────────────────────────────────────────────────────────
  if (pathname.startsWith('/teacher')) {
    const isPublic = pathname === '/teacher/login' || pathname === '/teacher/register';
    if (role !== 'teacher' && !isPublic) {
      return NextResponse.redirect(new URL('/teacher/login', req.url));
    }
    if (role === 'teacher' && isPublic) {
      return NextResponse.redirect(new URL('/teacher', req.url));
    }
  }

  // ── Student routes ─────────────────────────────────────────────────────────
  if (pathname.startsWith('/student')) {
    const isPublic = pathname === '/student/login' || pathname === '/student/register';
    if (role !== 'student' && !isPublic) {
      return NextResponse.redirect(new URL('/student/login', req.url));
    }
    if (role === 'student' && isPublic) {
      return NextResponse.redirect(new URL('/student/profile', req.url));
    }
  }
});

export const config = { matcher: ['/', '/teacher/:path*', '/student/:path*'] };
