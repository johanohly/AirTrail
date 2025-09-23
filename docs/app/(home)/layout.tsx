import { HomeLayout } from "fumadocs-ui/layouts/home";
import type React from "react";
import type { ReactNode } from "react";

import { baseOptions } from "@/app/layout.config";

type Props = {
  children: ReactNode;
};

export default function Layout({
  children,
}: Readonly<Props>): React.ReactElement {
  return (
    <HomeLayout {...baseOptions}>
      <main className="relative overflow-hidden px-2 pt-20 pb-40 md:px-4 md:pt-20 lg:px-8">
        <div className="relative z-20 mx-auto w-full max-w-[84rem]">
          {children}
        </div>
      </main>
    </HomeLayout>
  );
}
