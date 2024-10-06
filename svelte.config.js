import { preprocessMeltUI, sequence } from '@melt-ui/pp';
import adapter from 'svelte-adapter-bun';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config}*/
const config = {
  preprocess: sequence([vitePreprocess(), preprocessMeltUI()]),
  kit: {
    adapter: adapter(),
    version: { name: process.env.npm_package_version },
  },
};
export default config;
