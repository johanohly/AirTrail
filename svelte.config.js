import { preprocessMeltUI, sequence } from '@melt-ui/pp';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import adapter from 'svelte-adapter-bun';

const origin = process.env.ORIGINS || process.env.ORIGIN;

/** @type {import('@sveltejs/kit').Config}*/
const config = {
  preprocess: sequence([vitePreprocess(), preprocessMeltUI()]),
  kit: {
    adapter: adapter({ dynamic_origin: true }),
    version: { name: process.env.npm_package_version },
    csrf: {
      trustedOrigins: origin?.split(',').map((o) => o.trim()) ?? [],
    },
  },
};
export default config;
