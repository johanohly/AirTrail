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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
            // Track failed chunks
            window.__failedChunks = new Set();

            // Retry loading failed chunks
            function retryLoadChunk(url, maxRetries = 3) {
              if (window.__failedChunks.has(url)) return;
              
              let retries = 0;
              const loadScript = () => {
                if (retries >= maxRetries) {
                  window.__failedChunks.add(url);
                  return;
                }

                retries++;
                const script = document.createElement('script');
                script.src = url;
                script.async = true;
                script.onerror = () => {
                  setTimeout(loadScript, 1000 * retries);
                };
                document.head.appendChild(script);
              };

              loadScript();
            }

            // Handle errors and retry chunk loading
            window.onerror = function(msg, url, lineNo, columnNo, error) {
              if (url?.includes('/_next/') && 
                  (msg.includes('chunk') || msg.includes('Syntax'))) {
                retryLoadChunk(url);
              }
              return false;
            };

            // Handle script load failures
            window.addEventListener('error', function(event) {
              if (event.target?.tagName === 'SCRIPT') {
                const src = event.target.src;
                if (src.includes('/_next/')) {
                  retryLoadChunk(src);
                  event.preventDefault();
                }
              }
            }, true);
          `,
          }}
        />
      </head>
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
