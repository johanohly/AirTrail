import './global.css';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';

import { Provider } from '@/app/provider';
import { Metadata } from 'next';

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

function createMetadata(override: Metadata): Metadata {
  return {
    ...override,
    openGraph: {
      title: override.title ?? undefined,
      description: override.description ?? undefined,
      url: 'https://airtrail.johan.ohly.dk',
      images: '/dark.png',
      siteName: 'AirTrail',
      ...override.openGraph,
    },
    twitter: {
      card: 'summary_large_image',
      title: override.title ?? undefined,
      description: override.description ?? undefined,
      images: '/dark.png',
      ...override.twitter,
    },
  };
}

export const metadata = createMetadata({
  title: {
    template: '%s | AirTrail',
    default: 'AirTrail',
  },
  description: 'A modern, open-source personal flight tracking system.',
  metadataBase: new URL('https://airtrail.johan.ohly.dk'),
});
