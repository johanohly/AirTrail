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
    'favicon.ico',
    'pwa-192x192.png',
    'pwa-512x512.png',
    'pwa-maskable-192x192.png',
    'pwa-maskable-512x512.png',
    'countries.geojson'
  ],
  manifest: {
    name: 'AirTrail',
    description: 'A modern, open-source personal flight tracking system',
    categories: ['travel', 'navigation', 'utilities'],
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#3c83f6',
    icons: [
      {
        "src": "/pwa-192x192.png",
        "sizes": "192x192",
        "type": "image/png",
        "purpose": "any"
      },
      {
        "src": "/pwa-512x512.png",
        "sizes": "512x512",
        "type": "image/png",
        "purpose": "any"
      },
      {
        "src": "/pwa-maskable-192x192.png",
        "sizes": "192x192",
        "type": "image/png",
        "purpose": "maskable"
      },
      {
        "src": "/pwa-maskable-512x512.png",
        "sizes": "512x512",
        "type": "image/png",
        "purpose": "maskable"
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
