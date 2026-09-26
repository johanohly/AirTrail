import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { GithubStars } from "@/components/github-stars";

async function getStarCount(): Promise<number | undefined> {
  try {
    const res = await fetch("https://api.github.com/repos/johanohly/AirTrail", {
      next: { revalidate: 3600 },
    });
    const data = await res.json();
    return typeof data?.stargazers_count === "number"
      ? data.stargazers_count
      : undefined;
  } catch {
    return undefined;
  }
}

export async function getBaseOptions(): Promise<BaseLayoutProps> {
  const stars = await getStarCount();

  return {
    links: [
      {
        active: "nested-url",
        text: "Docs",
        url: "/docs/overview/introduction",
      },
      {
        active: "url",
        text: "Changelog",
        url: "/changelog",
      },
      {
        children: <GithubStars defaultCount={stars} />,
        secondary: true,
        type: "custom",
      },
    ],
    nav: {
      title: (
        <div className="flex items-center">
          <img
            alt="AirTrail Logo"
            className="h-6 w-auto"
            height={256}
            src="/logo.png"
            width={256}
          />
          <span style={{ marginLeft: "0.5rem" }}>AirTrail</span>
        </div>
      ),
    },
  };
}

// Sync fallback for static imports (without star count)
export const baseOptions: BaseLayoutProps = {
  links: [
    {
      active: "nested-url",
      text: "Docs",
      url: "/docs/overview/introduction",
    },
    {
      active: "url",
      text: "Changelog",
      url: "/changelog",
    },
    {
      children: <GithubStars />,
      secondary: true,
      type: "custom",
    },
  ],
  nav: {
    title: (
      <div className="flex items-center">
        <img
          alt="AirTrail Logo"
          className="h-6 w-auto"
          height={256}
          src="/logo.png"
          width={256}
        />
        <span style={{ marginLeft: "0.5rem" }}>AirTrail</span>
      </div>
    ),
  },
};
