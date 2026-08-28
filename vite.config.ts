import { o7Icon } from '@o7/icon/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { VitePWA, type VitePWAOptions } from 'vite-plugin-pwa';

const pwaOptions = {
  // SvelteKit builds client asset URLs relatively. Keep the service worker at
  // the application root so registration also works from nested routes.
  base: '/',
  scope: '/',
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
        // CARTO vector basemap resources. Keys are part of the request URL, so
        // rotating a key naturally creates a fresh cache entry.
        urlPattern: /^https:\/\/[^/]*\.?cartocdn\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'carto-basemap-v2',
          expiration: {
            maxEntries: 3000,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        // OpenFreeMap styles, sprites, glyphs, and vector tiles.
        urlPattern: /^https:\/\/[^/]*\.?openfreemap\.org\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'openfreemap-basemap',
          expiration: {
            maxEntries: 3000,
            maxAgeSeconds: 60 * 60 * 24 * 30,
          },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        // Protomaps hosted tiles and the official glyph/sprite assets. Direct
        // PMTiles range requests intentionally rely on the archive host cache.
        urlPattern:
          /^https:\/\/(api\.protomaps\.com|protomaps\.github\.io)\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'protomaps-basemap',
          expiration: {
            maxEntries: 3000,
            maxAgeSeconds: 60 * 60 * 24 * 30,
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
        // OpenAIP overlay vector tiles (airspaces, airports, navaids,
        // reporting points) proxied same-origin. Reuse tiles for 30 days to
        // avoid spending OpenAIP quota on repeat views.
        // Must come before the generic /api/map-styles/ rule below (first match
        // wins).
        urlPattern: /\/api\/map-styles\/openaip\/tiles\//,
        handler: 'CacheFirst',
        options: {
          cacheName: 'openaip-tiles',
          expiration: {
            maxEntries: 3000,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          },
          cacheableResponse: { statuses: [0, 200, 204] },
          // The proxy sets `Vary: cookie, authorization` for auth
          // correctness, but a tile is identical for every user, so
          // ignore Vary to guarantee cache hits across cookie changes.
          matchOptions: { ignoreVary: true },
        },
      },
      {
        // Same-origin map-style route (map-style JSON).
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
    // The dev worker only exercises runtime caching; Vite serves application
    // modules directly, so an empty precache is expected.
    suppressWarnings: true,
  },
} satisfies Partial<VitePWAOptions>;

export default defineConfig({
  resolve: {
    dedupe: ['@internationalized/date', 'maplibre-gl'],
  },
  plugins: [o7Icon(), tailwindcss(), sveltekit(), VitePWA(pwaOptions)],
});
