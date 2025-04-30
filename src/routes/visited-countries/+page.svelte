<script lang="ts">
  import maplibregl from 'maplibre-gl';
  import { mode } from 'mode-watcher';
  import { MapLibre } from 'svelte-maplibre';

  import {
    EditVisitedCountry,
    SetupVisitedCountries,
  } from '$lib/components/modals';
  import type { VisitedCountryStatus } from '$lib/db/types';
  import { trpc } from '$lib/trpc';
  import { countryFromAlpha } from '$lib/utils/data/countries';

  const countriesResult = trpc.visitedCountries.list.query();
  const countries = $derived.by(() => $countriesResult.data || []);
  const livedCountries = $derived.by(() =>
    countries.filter((c) => c.status === 'lived'),
  );
  const visitedCountries = $derived.by(() =>
    countries.filter((c) => c.status === 'visited'),
  );
  const layoverCountries = $derived.by(() =>
    countries.filter((c) => c.status === 'layover'),
  );
  const wishlistCountries = $derived.by(() =>
    countries.filter((c) => c.status === 'wishlist'),
  );

  $effect(() => {
    if (!map || !loaded || !layerLoaded) return;

    map.setPaintProperty(
      'countries',
      'fill-color',
      countries.length
        ? [
            'match',
            ['get', 'ISO3_CODE'],
            ...(livedCountries.length
              ? [livedCountries.map((c) => c.code), '#4ade80']
              : []),
            ...(visitedCountries.length
              ? [visitedCountries.map((c) => c.code), '#3C82F6']
              : []),
            ...(layoverCountries.length
              ? [layoverCountries.map((c) => c.code), '#66d9ef']
              : []),
            ...(wishlistCountries.length
              ? [wishlistCountries.map((c) => c.code), '#8b5cf6']
              : []),
            'rgba(0,0,0,0)',
          ]
        : 'rgba(0,0,0,0)',
    );
  });

  let map: maplibregl.Map | undefined = $state(undefined);
  let loaded = $state(false);
  let layerLoaded = $state(false);
  const style = $derived(
    $mode === 'light'
      ? 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
      : 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  );

  let editing = $state(false);
  let editingInfo: {
    id: number;
    status: (typeof VisitedCountryStatus)[number] | null;
    note: string | null;
  } | null = $state(null);

  const load = () => {
    if (!map) return;

    map.addSource('countries', {
      type: 'geojson',
      data: '/countries.geojson',
    });

    const firstLabelLayer = map
      .getStyle()
      .layers.find(
        (l) => l.type === 'symbol' && l.layout && l.layout['text-field'],
      )?.id;
    map.addLayer(
      {
        id: 'countries',
        type: 'fill',
        source: 'countries',
        paint: {
          'fill-color': countries.length
            ? [
                'match',
                ['get', 'ISO3_CODE'],
                ...(livedCountries.length
                  ? [livedCountries.map((c) => c.code), '#4ade80']
                  : []),
                ...(visitedCountries.length
                  ? [visitedCountries.map((c) => c.code), '#3C82F6']
                  : []),
                ...(layoverCountries.length
                  ? [layoverCountries.map((c) => c.code), '#66d9ef']
                  : []),
                ...(wishlistCountries.length
                  ? [wishlistCountries.map((c) => c.code), '#8b5cf6']
                  : []),
                'rgba(0,0,0,0)',
              ]
            : 'rgba(0,0,0,0)',
        },
      },
      firstLabelLayer,
    );

    layerLoaded = true;

    map.on('mouseenter', 'countries', () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'countries', () => {
      map.getCanvas().style.cursor = '';
    });

    map.on('click', 'countries', (e) => {
      if (e.features?.length) {
        const country = e.features[0];
        const code = country?.properties?.['ISO3_CODE'];
        const numeric = countryFromAlpha(code)?.numeric;
        if (numeric) {
          const countryData = countries.find((c) => c.numeric === numeric);
          editingInfo = {
            id: numeric,
            status: countryData?.status ?? null,
            note: countryData?.note ?? null,
          };
          editing = true;
        }
      }
    });
  };
</script>

<SetupVisitedCountries {visitedCountries} />
<EditVisitedCountry bind:open={editing} {editingInfo} />

<MapLibre {style} bind:map bind:loaded onload={load} />
