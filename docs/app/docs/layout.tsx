import { DocsLayout } from 'fumadocs-ui/layouts/notebook';
import type { ReactNode } from 'react';

import { baseOptions } from '@/app/layout.config';
import Squares from '@/components/Squares';
import { source } from '@/lib/source';

interface Props {
  children: ReactNode;
}

export default function Layout({ children }: Readonly<Props>) {
  return (
    <DocsLayout tree={source.pageTree} {...baseOptions}>
      <Squares />
      {children}
    </DocsLayout>
  );
}
