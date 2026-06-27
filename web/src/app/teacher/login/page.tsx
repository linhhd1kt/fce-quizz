import { signIn } from '@/auth';
import Link from 'next/link';

export default function TeacherLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-white">Đăng nhập Giáo viên</h1>
          <p className="text-slate-500 text-sm">Quản lý đề thi và theo dõi học sinh</p>
        </div>

        <form action={async () => {
          'use server';
          await signIn('google', { redirectTo: '/teacher' });
        }}>
          <button type="submit"
            className="w-full py-3 bg-white hover:bg-slate-100 text-slate-900 font-semibold rounded-xl transition-colors text-sm flex items-center justify-center gap-3">
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
              <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.04a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
              <path fill="#FBBC05" d="M4.5 10.48A4.8 4.8 0 0 1 4.5 7.5V5.43H1.83a8 8 0 0 0 0 7.12l2.67-2.07z"/>
              <path fill="#EA4335" d="M8.98 3.58c1.32 0 2.5.45 3.44 1.35L14.7 2.75A8 8 0 0 0 1.83 5.43L4.5 7.5c.65-1.94 2.44-3.92 4.48-3.92z"/>
            </svg>
            Đăng nhập bằng Google
          </button>
        </form>

        <p className="text-center">
          <Link href="/" className="text-xs text-slate-600 hover:text-slate-400">← Trang chủ</Link>
        </p>
      </div>
    </div>
  );
}
