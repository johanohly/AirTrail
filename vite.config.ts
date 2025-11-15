import { o7Icon } from '@o7/icon/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { VitePWA, type VitePWAOptions } from 'vite-plugin-pwa';

const pwaOptions: VitePWAOptions = {
  injectRegister: 'auto',
  registerType: 'autoUpdate',
  includeAssets: [
    'favicon.png', 
    'favicon.svg',
    'apple-touch-icon.png',
    'countries.geojson'
  ],
  manifest: {
    name: 'AirTrail',
    description: 'A modern, open-source personal flight tracking system',
    categories: ['travel', 'navigation', 'utilities'],
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#000000',
    theme_color: '#3c83f6',
    icons: [
      {
        "src": "/favicon.svg",
        "sizes": "any",
        "type": "image/svg+xml",
        "purpose": "any"
      },
      {
        "src": "/favicon.png",
        "sizes": "96x96",
        "type": "image/png",
        "purpose": "any"
      },
    ],
  },
  devOptions: {
    enabled: true,
  },
};

export default defineConfig({
  plugins: [
    o7Icon(), 
    tailwindcss(), 
    sveltekit(), 
    VitePWA(pwaOptions),
  ],
});
