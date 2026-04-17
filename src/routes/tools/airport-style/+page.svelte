<script lang="ts">
  import { browser } from '$app/environment';
  import { page } from '$app/state';
  import { base } from '$app/paths';
  import {
    AIRPORT_OVERLAY_CENTER,
    AIRPORT_OVERLAY_DEFAULT_ZOOM,
    AIRPORT_OVERLAY_PMTILES_PATH,
  } from '$lib/map/airport-overlay';
  import { AIRPORT_STYLE_ROUTE_PATH } from '$lib/map/airport-style';
  import { getAppMapImages } from '$lib/map/app-style';
  import { registerPmtilesProtocol } from '$lib/map/pmtiles';
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import {
    NavigationControl,
    AttributionControl,
    MapLibre,
  } from 'svelte-maplibre';

  const center = AIRPORT_OVERLAY_CENTER;
  let map: MapLibreMap | undefined = $state();
  let zoom = $state(AIRPORT_OVERLAY_DEFAULT_ZOOM);
  const theme = $derived(page.url.searchParams.get('theme') ?? 'light');
  const style = $derived(`${base}${AIRPORT_STYLE_ROUTE_PATH}?theme=${theme}`);

  const images = $derived(getAppMapImages(base));

  if (browser) {
    registerPmtilesProtocol();
  }

  $effect(() => {
    if (!map) {
      return;
    }

    const updateZoom = () => {
      zoom = Number(map.getZoom().toFixed(2));
    };

    updateZoom();
    map.on('zoom', updateZoom);

    return () => {
      map.off('zoom', updateZoom);
    };
  });
</script>

<div class="flex h-full flex-col">
  <div class="border-b bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
    <h1 class="text-lg font-medium">Airport Style Preview</h1>
    <p class="text-muted-foreground text-sm">
      CARTO light/dark basemap with airport detail overlays, centered on
      Copenhagen Airport.
    </p>
    <div class="mt-3 flex gap-2">
      <a
        href="?theme=light"
        class:text-primary={theme === 'light'}
        class:bg-muted={theme === 'light'}
        class="rounded-md border px-3 py-1.5 text-sm"
      >
        Light
      </a>
      <a
        href="?theme=dark"
        class:text-primary={theme === 'dark'}
        class:bg-muted={theme === 'dark'}
        class="rounded-md border px-3 py-1.5 text-sm"
      >
        Dark
      </a>
    </div>
    <p class="text-muted-foreground mt-2 text-sm">
      Loading the local airport overlay from
      <code>{AIRPORT_OVERLAY_PMTILES_PATH}</code>. Generate it with
      <code
        >bun run data:generate-airport-overlay --
        --input=.cache/geofabrik/denmark-latest.osm.pbf</code
      >
      if the overlay is missing.
    </p>
    <p class="text-muted-foreground mt-2 text-sm">Zoom: <code>{zoom}</code></p>
  </div>

  <MapLibre
    bind:map
    {style}
    {images}
    {center}
    zoom={AIRPORT_OVERLAY_DEFAULT_ZOOM}
    maxZoom={20}
    attributionControl={false}
    class="h-full"
  >
    <AttributionControl compact={true} />
    <NavigationControl />
  </MapLibre>
</div>
