import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { GithubStars } from '@/components/GithubStars';

async function getStarCount(): Promise<number | undefined> {
  try {
    const res = await fetch('https://api.github.com/repos/johanohly/AirTrail', {
      next: { revalidate: 3600 },
    });
    const data = await res.json();
    return typeof data?.stargazers_count === 'number'
      ? data.stargazers_count
      : undefined;
  } catch {
    return undefined;
  }
}

export async function getBaseOptions(): Promise<BaseLayoutProps> {
  const stars = await getStarCount();

  return {
    nav: {
      title: (
        <div className="flex items-center">
          <img
            alt="AirTrail Logo"
            src="/logo.png"
            style={{ height: '1.5rem' }}
          />
          <span style={{ marginLeft: '0.5rem' }}>AirTrail</span>
        </div>
      ),
    },
    links: [
      {
        text: 'Docs',
        url: '/docs/overview/introduction',
        active: 'nested-url',
      },
      {
        text: 'Changelog',
        url: '/changelog',
        active: 'url',
      },
      {
        type: 'custom',
        secondary: true,
        children: <GithubStars defaultCount={stars} />,
      },
    ],
  };
}

// Sync fallback for static imports (without star count)
export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <div className="flex items-center">
        <img alt="AirTrail Logo" src="/logo.png" style={{ height: '1.5rem' }} />
        <span style={{ marginLeft: '0.5rem' }}>AirTrail</span>
      </div>
    ),
  },
  links: [
    {
      text: 'Docs',
      url: '/docs/overview/introduction',
      active: 'nested-url',
    },
    {
      text: 'Changelog',
      url: '/changelog',
      active: 'url',
    },
    {
      type: 'custom',
      secondary: true,
      children: <GithubStars />,
    },
  ],
};
