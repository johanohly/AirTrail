'use client';
import { RootProvider } from 'fumadocs-ui/provider';
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

const SearchDialog = dynamic(() => import('@/components/Search'));

interface Props {
  children: ReactNode;
}

export function Provider({ children }: Readonly<Props>) {
  return (
    <RootProvider
      search={{
        SearchDialog,
      }}
    >
      {children}
    </RootProvider>
  );
}
