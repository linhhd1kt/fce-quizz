'use client';

import { usePathname } from 'next/navigation';
import { Toaster } from 'sonner';
import StudentSidebar from '@/components/student/StudentSidebar';

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
    <div className="h-screen overflow-hidden flex bg-slate-50 dark:bg-slate-950">
      <StudentSidebar />
      <main className="flex-1 overflow-y-auto min-w-0">
        {children}
      </main>
      <Toaster richColors position="top-right" />
    </div>
  );
}
