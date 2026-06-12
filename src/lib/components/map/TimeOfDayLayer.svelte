<script lang="ts">
  import { mode } from 'mode-watcher';
  import { onMount } from 'svelte';
  import { FillLayer, GeoJSON } from 'svelte-maplibre';

  import { mapPreferences } from '$lib/map/map-preferences.svelte';
  import {
    createTimeOfDayGeoJson,
    TIME_OF_DAY_LAYER_ID_PREFIX,
    TIME_OF_DAY_SEVERITIES,
    TIME_OF_DAY_SOURCE_ID,
    type TimeOfDayProjection,
  } from '$lib/map/time-of-day';

  const REFRESH_INTERVAL_MS = 60_000;
  const NIGHT_FILL = 'rgb(5, 8, 18)';

  let currentTime = $state(new Date());
  const projection = $derived(
    mapPreferences.projection === 'globe'
      ? ('globe' satisfies TimeOfDayProjection)
      : ('mercator' satisfies TimeOfDayProjection),
  );
  const data = $derived(createTimeOfDayGeoJson(currentTime, projection));
  const isDarkMode = $derived(mode.current === 'dark');
  const isSatellite = $derived(mapPreferences.basemap === 'satellite');
  const fillOpacityScale = $derived.by(() => {
    if (isSatellite) return 4.35;
    if (isDarkMode) return 12;
    return 1;
  });
  const getSeverityScale = (item: (typeof TIME_OF_DAY_SEVERITIES)[number]) =>
    !isSatellite && isDarkMode && item.severity === 'civil' ? 0.86 : 1;
  const getBaseOpacity = (item: (typeof TIME_OF_DAY_SEVERITIES)[number]) =>
    isSatellite || !isDarkMode ? item.lightOpacity : item.darkOpacity;
  const getFillOpacity = (item: (typeof TIME_OF_DAY_SEVERITIES)[number]) =>
    getBaseOpacity(item) * fillOpacityScale * getSeverityScale(item);

  onMount(() => {
    const interval = window.setInterval(() => {
      currentTime = new Date();
    }, REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  });
</script>

<GeoJSON id={TIME_OF_DAY_SOURCE_ID} {data} tolerance={0}>
  {#each TIME_OF_DAY_SEVERITIES as item (item.severity)}
    <FillLayer
      id={`${TIME_OF_DAY_LAYER_ID_PREFIX}-${item.severity}`}
      beforeLayerType="symbol"
      interactive={false}
      filter={['==', ['get', 'severity'], item.severity]}
      paint={{
        'fill-color': NIGHT_FILL,
        'fill-opacity': getFillOpacity(item),
        'fill-antialias': true,
      }}
    />
  {/each}
</GeoJSON>
