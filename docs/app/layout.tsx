import "./global.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import { Provider } from "@/app/provider";

const inter = Inter({
  subsets: ["latin"],
});

type Props = {
  children: ReactNode;
};

export default function Layout({ children }: Readonly<Props>) {
  return (
    <html className={inter.className} lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
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
      url: "https://airtrail.johan.ohly.dk",
      images: "/dark.png",
      siteName: "AirTrail",
      ...override.openGraph,
    },
    twitter: {
      card: "summary_large_image",
      title: override.title ?? undefined,
      description: override.description ?? undefined,
      images: "/dark.png",
      ...override.twitter,
    },
  };
}

export const metadata = createMetadata({
  title: {
    template: "%s | AirTrail",
    default: "AirTrail",
  },
  description: "A modern, open-source personal flight tracking system.",
  metadataBase: new URL("https://airtrail.johan.ohly.dk"),
});
