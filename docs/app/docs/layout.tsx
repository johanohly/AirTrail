import { DocsLayout } from 'fumadocs-ui/layouts/notebook';
import type { ReactNode } from 'react';

import { baseOptions } from '@/app/layout.config';
import Squares from '@/components/Squares';
import { source } from '@/lib/source';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout tree={source.pageTree} {...baseOptions}>
      <Squares />
      {children}
    </DocsLayout>
  );
}
