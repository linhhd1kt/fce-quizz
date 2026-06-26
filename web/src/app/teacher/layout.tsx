'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const isAuthPage = pathname === '/teacher/login' || pathname === '/teacher/register';
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session && !isAuthPage) {
        router.replace('/teacher/login');
      } else if (session && isAuthPage) {
        router.replace('/teacher');
      } else {
        setChecking(false);
      }
    });
  }, [pathname, router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <p className="text-slate-500 text-sm">Đang kiểm tra đăng nhập…</p>
      </div>
    );
  }

  return <>{children}</>;
}
