<script lang="ts">
  import { RefreshCw } from '@o7/icon/lucide';
  import maplibregl from 'maplibre-gl';
  import { mode } from 'mode-watcher';
  import {
    MapLibre,
    Control,
    ControlGroup,
    ControlButton,
    GeolocateControl,
    AttributionControl,
    NavigationControl,
    VectorTileSource,
    FillLayer,
    type LayerClickInfo,
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

  const buildFillColor = (): maplibregl.ExpressionSpecification | string =>
    countries.length
      ? ([
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
        ] as unknown as maplibregl.ExpressionSpecification)
      : 'rgba(0,0,0,0)';

  let map: maplibregl.Map | undefined = $state(undefined);
  let loaded = $state(false);
  const style = $derived(
    mode.current === 'light'
      ? 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
      : 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  );

  let editing = $state(false);
  let editingInfo: {
    id: number;
    status: (typeof VisitedCountryStatus)[number] | null;
    note: string | null;
  } | null = $state(null);

  let firstLabelLayerId = $state<string | undefined>(undefined);

  const updateLabelLayerId = (currentMap: maplibregl.Map) => {
    const layers = currentMap.getStyle().layers ?? [];
    firstLabelLayerId = layers.find(
      (layer) =>
        layer.type === 'symbol' && layer.layout && layer.layout['text-field'],
    )?.id;
  };

  const load = async () => {
    const currentMap = map;
    if (!currentMap) return;

    updateLabelLayerId(currentMap);
    currentMap.on('style.load', () => updateLabelLayerId(currentMap));

    await fitCountries();
  };

  const handleCountryClick = (event: LayerClickInfo) => {
    if (event.features?.length) {
      const country = event.features[0];
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
  };

  type CountryBounds = Record<string, [number, number, number, number]>;
  let countryBounds: CountryBounds | null = null;
  const fitCountries = async () => {
    const codes: string[] = [
      ...livedCountries,
      ...visitedCountries,
      ...layoverCountries,
      ...wishlistCountries,
    ].map((c) => c.alpha3);

    if (!map || !codes.length) return;

    if (!countryBounds) {
      const response = await fetch('/countries-bounds.json');
      countryBounds = (await response.json()) as CountryBounds;
    }

    let west = Infinity;
    let south = Infinity;
    let east = -Infinity;
    let north = -Infinity;

    for (const code of codes) {
      const bounds = countryBounds[code];
      if (!bounds) continue;
      const [minX, minY, maxX, maxY] = bounds;
      west = Math.min(west, minX);
      south = Math.min(south, minY);
      east = Math.max(east, maxX);
      north = Math.max(north, maxY);
    }

    if (!Number.isFinite(west)) return;

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

  <VectorTileSource id="countries" url="pmtiles:///countries.pmtiles">
    <FillLayer
      id="countries"
      sourceLayer="countries"
      beforeId={firstLabelLayerId}
      beforeLayerType="symbol"
      hoverCursor="pointer"
      interactive
      paint={{ 'fill-color': buildFillColor() }}
      onclick={handleCountryClick}
    />
  </VectorTileSource>

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
