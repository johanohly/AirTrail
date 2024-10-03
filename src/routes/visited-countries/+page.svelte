<script lang="ts">
  import { geoNaturalEarth1, geoOrthographic } from 'd3-geo';
  import { feature } from 'topojson-client';
  import { Chart, GeoPath, Graticule, Svg, Tooltip } from 'layerchart';
  import { COUNTRIES_GEO } from '$lib/data/countries-geo';
  import { Switch } from '$lib/components/ui/switch';
  import { trpc } from '$lib/trpc';
  import { SetupVisitedCountries } from '$lib/components/modals';
  import { cn } from '$lib/utils';
  import { Separator } from '$lib/components/ui/separator';

  const visitedCountriesResult = trpc.visitedCountries.list.query();
  const visitedCountries = $derived.by(
    () => $visitedCountriesResult.data || [],
  );
  const getCountry = (code: string) =>
    visitedCountries.find((c) => String(c.code) === code);

  let globe = $state(true);
  const projection = $derived(globe ? geoOrthographic : geoNaturalEarth1);

  const geojson = feature(COUNTRIES_GEO, COUNTRIES_GEO.objects.countries);
  const features = geojson.features;
</script>

<SetupVisitedCountries {visitedCountries} />

<div class="absolute right-10 bottom-10 z-10">
  <div class="bg-background/70 border rounded-2xl p-5 backdrop-blur-md">
    <div class="flex gap-6">
      <span class="text-sm font-medium">Globe</span>
      <Switch bind:checked={globe} size="small" />
    </div>
    <Separator class="my-3" />
    <h5 class="text-sm font-medium">Legend</h5>
    {@render legendItem('bg-primary', 'Visited')}
    {@render legendItem('bg-green-400', 'Lived')}
    {@render legendItem('bg-tertiary', 'Layover')}
    {@render legendItem('bg-violet-500', 'Wishlist')}
  </div>
</div>

{#snippet legendItem(color, label)}
  <div class="flex items-center gap-2">
    <div class={cn('size-4 rounded-sm', color)} />
    <span class="text-sm">{label}</span>
  </div>
{/snippet}

<div class="flex flex-col h-full py-10">
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
        {@const country = getCountry(feature.id)}
        <GeoPath
          geojson={feature}
          {tooltip}
          class={cn('stroke-surface-content/50 fill-white cursor-pointer', {
            'dark:fill-zinc-800': !country,
            'fill-primary': country && country.status === 'visited',
            'fill-green-400': country && country.status === 'lived',
            'fill-tertiary': country && country.status === 'layover',
            'fill-violet-500': country && country.status === 'wishlist',
          })}
        />
      {/each}
    </Svg>

    <Tooltip.Root class="max-w-sm" let:data>
      <p>{data.properties.name}</p>
      <p class="text-sm text-muted-foreground overflow-auto">
        {getCountry(data.id)?.note}
      </p>
    </Tooltip.Root>
  </Chart>
</div>
