import { preprocessMeltUI, sequence } from '@melt-ui/pp';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import adapter from 'svelte-adapter-bun';

/** @type {import('@sveltejs/kit').Config}*/
const config = {
  preprocess: sequence([vitePreprocess(), preprocessMeltUI()]),
  kit: {
    adapter: adapter(),
    version: { name: process.env.npm_package_version },
    csrf: {
      checkOrigin: false,
    },
  },
};
export default config;
