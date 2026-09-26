import "./global.css";
import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { Provider } from "@/app/provider";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

interface Props {
  children: ReactNode;
}

export default function Layout({ children }: Readonly<Props>) {
  return (
    <html className={dmSans.className} lang="en" suppressHydrationWarning>
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
      description: override.description ?? undefined,
      images: "/dark.png",
      siteName: "AirTrail",
      title: override.title ?? undefined,
      url: "https://airtrail.johan.ohly.dk",
      ...override.openGraph,
    },
    twitter: {
      card: "summary_large_image",
      description: override.description ?? undefined,
      images: "/dark.png",
      title: override.title ?? undefined,
      ...override.twitter,
    },
  };
}

export const metadata = createMetadata({
  description: "A modern, open-source personal flight tracking system.",
  metadataBase: new URL("https://airtrail.johan.ohly.dk"),
  title: {
    default: "AirTrail",
    template: "%s | AirTrail",
  },
});
