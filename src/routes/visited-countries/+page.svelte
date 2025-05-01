<script lang="ts">
  import { RefreshCw } from '@o7/icon/lucide';
  import { bbox, featureCollection } from '@turf/turf';
  import maplibregl from 'maplibre-gl';
  import { mode } from 'mode-watcher';
  import {
    type GeoJSON,
    MapLibre,
    Control,
    ControlGroup,
    ControlButton,
    GeolocateControl,
    AttributionControl,
    NavigationControl,
  } from 'svelte-maplibre';
  import { toast } from 'svelte-sonner';

  import { OnResizeEnd } from '$lib/components/helpers';
  import {
    EditVisitedCountry,
    SetupVisitedCountries,
  } from '$lib/components/modals';
  import type { VisitedCountryStatus } from '$lib/db/types';
  import { api, trpc } from '$lib/trpc';
  import { pluralize } from '$lib/utils';
  import { countryFromAlpha3 } from '$lib/utils/data/countries';

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
              ? [livedCountries.map((c) => c.alpha3), '#4ade80']
              : []),
            ...(visitedCountries.length
              ? [visitedCountries.map((c) => c.alpha3), '#3C82F6']
              : []),
            ...(layoverCountries.length
              ? [layoverCountries.map((c) => c.alpha3), '#66d9ef']
              : []),
            ...(wishlistCountries.length
              ? [wishlistCountries.map((c) => c.alpha3), '#8b5cf6']
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

  const load = async () => {
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
                  ? [livedCountries.map((c) => c.alpha3), '#4ade80']
                  : []),
                ...(visitedCountries.length
                  ? [visitedCountries.map((c) => c.alpha3), '#3C82F6']
                  : []),
                ...(layoverCountries.length
                  ? [layoverCountries.map((c) => c.alpha3), '#66d9ef']
                  : []),
                ...(wishlistCountries.length
                  ? [wishlistCountries.map((c) => c.alpha3), '#8b5cf6']
                  : []),
                'rgba(0,0,0,0)',
              ]
            : 'rgba(0,0,0,0)',
        },
      },
      firstLabelLayer,
    );

    layerLoaded = true;

    await fitCountries();

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
        const numeric = countryFromAlpha3(code)?.numeric;
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

  let geoData: GeoJSON.FeatureCollection | null = null;
  const fitCountries = async () => {
    const codes: string[] = [
      ...livedCountries,
      ...visitedCountries,
      ...layoverCountries,
      ...wishlistCountries,
    ].map((c) => c.alpha3);

    if (!map || !codes.length) return;

    if (!geoData) {
      const src = map.getSource('countries') as maplibregl.GeoJSONSource;
      geoData = (await src.getData()) as GeoJSON.FeatureCollection;
    }

    const features = geoData.features.filter((f) =>
      codes.includes(f.properties?.ISO3_CODE),
    );
    if (!features.length) return;

    const [west, south, east, north] = bbox(featureCollection(features));
    const bounds: [[number, number], [number, number]] = [
      [west, south],
      [east, north],
    ];
    map.fitBounds(bounds, {
      padding: 20,
      linear: false,
    });
  };

  const syncFlights = async () => {
    const result = await api.visitedCountries.importFlights.mutate();
    if (result) {
      await trpc.visitedCountries.list.utils.invalidate();
      await fitCountries();
      toast.success(
        `Marked ${result} ${pluralize(result, 'country', 'countries')} as visited`,
      );
    } else {
      toast.error('No changes found.');
    }
  };
</script>

<OnResizeEnd callback={fitCountries} />
<SetupVisitedCountries {countries} {fitCountries} />
<EditVisitedCountry bind:open={editing} {editingInfo} />

<MapLibre
  {style}
  projection={{ type: 'globe' }}
  diffStyleUpdates
  zoom={2}
  bind:map
  bind:loaded
  onload={load}
  attributionControl={false}
>
  <AttributionControl compact={true} />
  <NavigationControl />
  <GeolocateControl />

  <Control position="top-left">
    <ControlGroup>
      <ControlButton
        onclick={syncFlights}
        title="Sync from flights (will never overwrite)"
      >
        <RefreshCw size={20} />
      </ControlButton>
    </ControlGroup>
  </Control>
</MapLibre>
