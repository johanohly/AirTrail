import { HomeLayout } from 'fumadocs-ui/layouts/home';
import React, { ReactNode } from 'react';

import { baseOptions } from '@/app/layout.config';

interface Props {
  children: ReactNode;
}

export default function Layout({
  children,
}: Readonly<Props>): React.ReactElement {
  return (
    <HomeLayout {...baseOptions}>
      <main className="relative pb-40 pt-20 md:pt-20 overflow-hidden px-2 md:px-4 lg:px-8">
        <div className="max-w-[84rem] w-full mx-auto relative z-20">
          {children}
        </div>
      </main>
    </HomeLayout>
  );
}
