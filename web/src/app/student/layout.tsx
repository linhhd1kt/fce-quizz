'use client';

import { usePathname } from 'next/navigation';
import { Toaster } from 'sonner';
import StudentTopNav from '@/components/student/StudentTopNav';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = pathname === '/student/login' || pathname === '/student/register';

  if (isPublic) {
    return (
      <>
        {children}
        <Toaster richColors position="top-right" />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <StudentTopNav />
      <main className="flex-1">
        {children}
      </main>
      <Toaster richColors position="top-right" />
    </div>
  );
}
