// @ts-check
import react from '@astrojs/react';
import starlight from '@astrojs/starlight';
import tailwind from '@astrojs/tailwind';
import { defineConfig } from 'astro/config';
import starlightImageZoom from 'starlight-image-zoom';
import starlightLinksValidator from 'starlight-links-validator';

// https://astro.build/config
export default defineConfig({
  site: 'https://airtrail.johan.ohly.dk',
  integrations: [
    starlight({
      title: 'AirTrail',
      description: 'A modern, open-source personal flight tracking system',
      logo: {
        dark: '@/assets/airtrail-logo-light.png',
        light: '@/assets/airtrail-logo.png',
      },
      customCss: ['@/styles/globals.css'],
      social: {
        github: 'https://github.com/johanohly/AirTrail',
      },
      sidebar: [
        {
          label: 'Overview',
          items: [
            'docs/overview/introduction',
            'docs/overview/quick-start',
            'docs/overview/contributing',
          ],
        },
        {
          label: 'Install',
          items: [
            'docs/install/requirements',
            'docs/install/one-click',
            'docs/install/docker-compose',
            'docs/install/portainer',
            'docs/install/synology',
            'docs/install/manual',
            'docs/install/post-installation',
            'docs/install/updating',
          ],
        },
        {
          label: 'Features',
          items: [
            'docs/features/add-flight',
            'docs/features/statistics',
            'docs/features/import',
            'docs/features/export',
            'docs/features/oauth',
          ],
        },
        {
          label: 'Development',
          items: ['docs/development/contributing-guidelines'],
        },
      ],
      lastUpdated: true,
      editLink: {
        baseUrl: 'https://github.com/johanohly/AirTrail/edit/main/docs',
      },
      favicon: '/favicon.png',
      plugins: [
        starlightLinksValidator({ errorOnRelativeLinks: false }),
        starlightImageZoom(),
      ],
      components: {
        SocialIcons: '@/components/overrides/SocialIcons.astro',
        Banner: '@/components/overrides/Banner.astro',
      },
      disable404Route: true,
    }),
    react(),
    tailwind({
      applyBaseStyles: false,
    }),
  ],
});
