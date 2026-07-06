'use client';

import { usePathname } from 'next/navigation';
import { Toaster } from 'sonner';
import { Suspense } from 'react';
import TeacherSidebar from '@/components/teacher/TeacherSidebar';
import QuizzesPanel from '@/components/teacher/QuizzesPanel';

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = pathname === '/teacher/login' || pathname === '/teacher/register';
  const showQuizzesPanel = pathname.startsWith('/teacher/quizzes');

  if (isPublic) {
    return (
      <>
        {children}
        <Toaster richColors position="top-right" />
      </>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex bg-slate-50 dark:bg-slate-950">
      <TeacherSidebar />
      {showQuizzesPanel && (
        <Suspense>
          <QuizzesPanel />
        </Suspense>
      )}
      <main className="flex-1 overflow-y-auto min-w-0">
        {children}
      </main>
      <Toaster richColors position="top-right" />
    </div>
  );
}
