import { DocsLayout } from 'fumadocs-ui/layouts/notebook';
import type { ReactNode } from 'react';

import { getBaseOptions } from '@/app/layout.config';
import Squares from '@/components/Squares';
import { source } from '@/lib/source';

type Props = {
  children: ReactNode;
};

export default async function Layout({ children }: Readonly<Props>) {
  const baseOptions = await getBaseOptions();

  return (
    <DocsLayout tree={source.pageTree} {...baseOptions}>
      <Squares />
      {children}
    </DocsLayout>
  );
}
