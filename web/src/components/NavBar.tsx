'use client';

import Link from 'next/link';
import { useI18n, SUPPORTED_LOCALES } from '@/i18n';

export default function NavBar() {
  const { msgs, locale, setLocale } = useI18n();
  const m = msgs.nav;

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
      <nav className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-white tracking-tight">
          FCE<span className="text-blue-400">Quiz</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link href="/" className="px-3 py-1.5 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
            {m.home}
          </Link>
          <Link href="/leaderboard" className="px-3 py-1.5 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
            {m.scores}
          </Link>
          <Link href="/import" className="px-3 py-1.5 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
            {m.import}
          </Link>

          {/* Language switcher */}
          <div className="flex items-center gap-0.5 ml-2 border border-slate-700 rounded-lg overflow-hidden">
            {SUPPORTED_LOCALES.map(({ code, label }) => (
              <button
                key={code}
                onClick={() => setLocale(code)}
                className={`px-2.5 py-1 text-xs font-semibold transition-colors ${
                  locale === code
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </nav>
    </header>
  );
}
