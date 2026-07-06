'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useTheme } from '@/hooks/useTheme';

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

const NAV_ITEMS = [
  { href: '/student/home', label: 'Home' },
  { href: '/student/activity', label: 'Activity' },
  { href: '/student/leaderboard', label: 'Scores' },
];

export default function StudentTopNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { theme, toggleTheme } = useTheme();

  const name = (session?.user as { username?: string } | undefined)?.username
    ?? session?.user?.name
    ?? 'S';
  const initials = name[0]?.toUpperCase() ?? 'S';

  return (
    <header className="h-14 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center px-4 gap-3">
      <Link
        href="/student/home"
        className="text-blue-600 dark:text-blue-400 font-black text-sm mr-2 hover:opacity-80 transition-opacity"
      >
        FCEQuiz
      </Link>

      <nav className="flex items-center gap-1 flex-1">
        {NAV_ITEMS.map(({ href, label }) => {
          const active = pathname.startsWith(href) || (href === '/student/home' && pathname === '/student/profile');
          return (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>

      <button
        onClick={() => signOut({ redirectTo: '/student/login' })}
        title={`Sign out (${name})`}
        className="w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold flex items-center justify-center transition-colors shrink-0"
      >
        {initials}
      </button>
    </header>
  );
}
