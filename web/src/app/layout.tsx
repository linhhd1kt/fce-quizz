import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import Providers from '@/components/Providers';
import NavBar from '@/components/NavBar';

const geist = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'FCE Quiz',
  description: 'Practice B2 First for Schools exam questions',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Anti-flash: apply dark class before React hydrates. Default: dark. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('fce-theme');if(t!=='light')document.documentElement.classList.add('dark');})()`
          }}
        />
      </head>
      <body className={`${geist.className} bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100 min-h-screen`}>
        <Providers>
          <NavBar />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
