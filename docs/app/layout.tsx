import './global.css';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';

import { Provider } from '@/app/provider';

const inter = Inter({
  subsets: ['latin'],
});

interface Props {
  children: ReactNode;
}

export default function Layout({ children }: Readonly<Props>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
