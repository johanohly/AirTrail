import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

/**
 * Shared layout configurations
 *
 * you can configure layouts individually from:
 * Home Layout: app/(home)/layout.tsx
 * Docs Layout: app/docs/layout.tsx
 */
export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <div className="flex items-center">
        <img
          src="/logo.png"
          alt="AirTrail Logo"
          style={{ height: '1.5rem' }}
        />
        <span style={{ marginLeft: '0.5rem' }}>AirTrail</span>
      </div>
    ),
  },
  githubUrl: 'https://github.com/JohanOhly/AirTrail',
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
  ],
};
