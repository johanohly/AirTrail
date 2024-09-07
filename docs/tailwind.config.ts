import type { Config } from 'tailwindcss';
import { fontFamily } from 'tailwindcss/defaultTheme';

export default {
  corePlugins: {
    preflight: false,
  },
  content: ['./src/**/*.{js,jsx,ts,tsx}', './docs/**/*.{md,mdx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  fontFamily: {
    sans: ['Public Sans', ...fontFamily.sans],
  },
  theme: {
    extend: {
      colors: {
        'dark-1': '#0d0d0f',
        'dark-2': '#141416',
        primary: {
          DEFAULT: 'var(--ifm-color-primary)',
          foreground: 'var(--ifm-color-primary-lightest)',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
