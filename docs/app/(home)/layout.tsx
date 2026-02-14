import { HomeLayout } from 'fumadocs-ui/layouts/home';
import type React from 'react';
import type { ReactNode } from 'react';

import { getBaseOptions } from '@/app/layout.config';

type Props = {
  children: ReactNode;
};

export default async function Layout({
  children,
}: Readonly<Props>): Promise<React.ReactElement> {
  const baseOptions = await getBaseOptions();

  return (
    <HomeLayout
      {...baseOptions}
      className="dark:bg-neutral-950 dark:[--color-fd-background:var(--color-neutral-950)]"
    >
      <main className="relative overflow-x-clip px-4 pt-8 pb-24 md:px-6 md:pt-12 lg:px-8">
        <div className="relative z-20 mx-auto w-full max-w-[1400px]">
          {children}
        </div>
      </main>
    </HomeLayout>
  );
}
