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
    <html lang="en" className="dark">
      <body className={`${geist.className} bg-slate-950 text-slate-100 min-h-screen`}>
        <Providers>
          <NavBar />
          <main className="max-w-3xl mx-auto px-4 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
