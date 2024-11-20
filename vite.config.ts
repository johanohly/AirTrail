import { o7Icon } from '@o7/icon/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [o7Icon(), sveltekit()],
});
