import { o7Icon } from '@o7/icon/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { VitePWA, type VitePWAOptions } from 'vite-plugin-pwa';

const pwaOptions = {
  // SvelteKit doesn't run vite-plugin-pwa's HTML injection, so the service
  // worker is registered manually in src/routes/+layout.svelte.
  injectRegister: null,
  workbox: {
    maximumFileSizeToCacheInBytes: 3000000,
    // SvelteKit doesn't serve the separate workbox-*.js runtime chunk (it
    // 404s), which silently leaves the service worker inert. Inline it instead.
    inlineWorkboxRuntime: true,
    // adapter-node has no index.html, so the default `navigateFallback:
    // 'index.html'` makes Workbox throw and disables every route below.
    // Navigations are served by the Node server, not the service worker.
    navigateFallback: null,
    // Cache map tiles/styles as the user browses, so repeat views load from
    // cache instead of re-fetching them from external providers.
    runtimeCaching: [
      {
        // Carto basemap: style.json, sprite, glyphs, vector + raster tiles.
        urlPattern: /^https:\/\/[^/]*\.?cartocdn\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'carto-basemap',
          expiration: {
            maxEntries: 3000,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        // ArcGIS World Imagery tiles (satellite basemap).
        urlPattern: /^https:\/\/services\.arcgisonline\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'arcgis-satellite',
          expiration: {
            maxEntries: 2000,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        // Same-origin map-style route + OpenAIP tile proxy.
        urlPattern: /\/api\/map-styles\//,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'map-styles',
          expiration: {
            maxEntries: 500,
            maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
          },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },
  registerType: 'autoUpdate',
  includeAssets: [
    'favicon.png',
    'favicon.svg',
    'apple-touch-icon.png',
    'icon-192.png',
    'icon-512.png',
    'icon-512-maskable.png',
    'countries-bounds.json',
  ],
  manifest: {
    id: '/',
    name: 'AirTrail',
    short_name: 'AirTrail',
    description: 'A modern, open-source personal flight tracking system',
    lang: 'en',
    categories: ['travel', 'navigation', 'utilities'],
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#000000',
    theme_color: '#3c83f6',
    icons: [
      {
        src: '/favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/favicon.png',
        sizes: '96x96',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  },
  devOptions: {
    enabled: true,
  },
} satisfies Partial<VitePWAOptions>;

export default defineConfig({
  resolve: {
    dedupe: ['maplibre-gl'],
  },
  plugins: [o7Icon(), tailwindcss(), sveltekit(), VitePWA(pwaOptions)],
});
