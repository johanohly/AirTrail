<script lang="ts">
  import { geoNaturalEarth1, geoOrthographic } from 'd3-geo';
  import { feature } from 'topojson-client';
  import { Chart, GeoPath, Graticule, Svg, Tooltip } from 'layerchart';
  import { COUNTRIES_GEO } from '$lib/data/countries-geo';
  import { Switch } from '$lib/components/ui/switch';

  let globe = $state(true);
  const projection = $derived(globe ? geoOrthographic : geoNaturalEarth1);

  const geojson = feature(COUNTRIES_GEO, COUNTRIES_GEO.objects.countries);
  const features = geojson.features;
</script>

<div class={'flex flex-col h-full'}>
  <div class="flex justify-between">
    <h2 class="text-3xl font-bold tracking-tight">Visited Countries</h2>
    <Switch bind:checked={globe} />
  </div>
  <Chart
    geo={{
      projection,
      fitGeojson: geojson,
      applyTransform: ['rotate'],
    }}
    padding={{ left: 100, right: 100 }}
    let:tooltip
  >
    <Svg>
      <GeoPath
        geojson={{ type: 'Sphere' }}
        class="fill-blue-400/50 dark:fill-none stroke-surface-content"
      />
      <Graticule class="stroke-surface-content/20 pointer-events-none" />
      {#each features as feature}
        <GeoPath
          geojson={feature}
          {tooltip}
          class="stroke-surface-content/50 fill-white cursor-pointer"
        />
      {/each}
    </Svg>

    <Tooltip.Root let:data>
      {data.properties.name}
    </Tooltip.Root>
  </Chart>
</div>
