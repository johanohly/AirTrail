import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'AirTrail',
  tagline: 'A modern, open-source personal flight tracking system',
  favicon: 'img/airtrail-logo.png',

  url: 'https://johanohly.github.io',
  baseUrl: '/airtrail/',

  organizationName: 'johanohly',
  projectName: 'airtrail',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  plugins: [
    async function myPlugin(context, options) {
      return {
        name: 'docusaurus-tailwindcss',
        configurePostCss(postcssOptions) {
          // Appends TailwindCSS and AutoPrefixer.
          postcssOptions.plugins.push(require('tailwindcss'));
          postcssOptions.plugins.push(require('autoprefixer'));
          return postcssOptions;
        },
      };
    },
    require.resolve('docusaurus-lunr-search'),
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          showLastUpdateAuthor: true,
          showLastUpdateTime: true,

          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/JohanOhly/AirTrail/tree/main/docs/',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/',
    colorMode: {
      defaultMode: 'dark',
    },
    announcementBar: {
      id: 'announcement_bar',
      content: `⚠️ The project is under <strong>very active</strong> development. Expect bugs and changes.`,
      backgroundColor: '#593f00',
      textColor: '#ffefc9',
      isCloseable: false,
    },
    docs: {
      sidebar: {
        autoCollapseCategories: false,
      },
    },
    navbar: {
      logo: {
        alt: 'AirTrail Logo',
        src: 'img/airtrail-logo-text.png',
        srcDark: 'img/airtrail-logo-text-dark.png',
        className: 'rounded-none',
      },
      items: [
        {
          to: '/docs/overview/introduction',
          position: 'right',
          label: 'Docs',
        },
        {
          to: '/roadmap',
          position: 'right',
          label: 'Roadmap',
        },
        {
          href: 'https://github.com/JohanOhly/AirTrail',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'light',
      links: [
        {
          title: 'Overview',
          items: [
            {
              label: 'Welcome',
              to: '/docs/overview/introduction',
            },
            {
              label: 'Installation',
              to: '/docs/install/requirements',
            },
            {
              label: 'Contributing',
              to: '/docs/overview/contributing',
            },
            {
              label: 'Privacy Policy',
              to: '/privacy-policy',
            },
          ],
        },
        {
          title: 'Documentation',
          items: [
            {
              label: 'Roadmap',
              to: '/roadmap',
            },
          ],
        },
        {
          title: 'Links',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/JohanOhly/AirTrail',
            },
          ],
        },
      ],
      copyright: `AirTrail is available as open-source under the terms of the GNU GPL-3.0 license.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['sql', 'diff', 'bash', 'powershell'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
