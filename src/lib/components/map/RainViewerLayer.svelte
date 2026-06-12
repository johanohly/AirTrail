<script lang="ts">
  import { mode } from 'mode-watcher';
  import { onMount } from 'svelte';
  import { RasterLayer, RasterTileSource } from 'svelte-maplibre';

  import {
    getLatestRainViewerTileTemplate,
    RAINVIEWER_LAYER_ID,
    RAINVIEWER_MAX_NATIVE_ZOOM,
    RAINVIEWER_METADATA_URL,
    RAINVIEWER_SOURCE_ID,
  } from '$lib/map/rainviewer';

  const REFRESH_INTERVAL_MS = 5 * 60_000;

  let tileTemplate = $state<string | null>(null);
  const opacity = $derived(mode.current === 'dark' ? 0.42 : 0.58);

  const refreshTileTemplate = async (signal?: AbortSignal) => {
    const response = await fetch(RAINVIEWER_METADATA_URL, {
      signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      return;
    }

    tileTemplate = getLatestRainViewerTileTemplate(await response.json());
  };

  onMount(() => {
    const controller = new AbortController();

    refreshTileTemplate(controller.signal).catch(() => {
      tileTemplate = null;
    });

    const interval = window.setInterval(() => {
      refreshTileTemplate().catch(() => {
        tileTemplate = null;
      });
    }, REFRESH_INTERVAL_MS);

    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  });
</script>

{#if tileTemplate}
  <RasterTileSource
    id={RAINVIEWER_SOURCE_ID}
    tiles={[tileTemplate]}
    tileSize={512}
    minzoom={0}
    maxzoom={RAINVIEWER_MAX_NATIVE_ZOOM}
    attribution={'<a href="https://www.rainviewer.com" target="_blank" rel="noreferrer">RainViewer</a>'}
  >
    <RasterLayer
      id={RAINVIEWER_LAYER_ID}
      beforeLayerType="symbol"
      paint={{
        'raster-opacity': opacity,
        'raster-fade-duration': 250,
        'raster-resampling': 'linear',
      }}
    />
  </RasterTileSource>
{/if}
