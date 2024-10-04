<script lang="ts">
  import { geoNaturalEarth1, geoOrthographic } from 'd3-geo';
  import { feature } from 'topojson-client';
  import {
    Chart,
    geoFitObjectTransform,
    GeoPath,
    Graticule,
    Svg,
    Tooltip,
    TransformContext,
  } from 'layerchart';
  import { COUNTRIES_GEO } from '$lib/data/countries-geo';
  import { trpc } from '$lib/trpc';
  import {
    EditVisitedCountry,
    SetupVisitedCountries,
  } from '$lib/components/modals';
  import { cn } from '$lib/utils';
  import { Button } from '$lib/components/ui/button';
  import { ZoomIn, ZoomOut } from '@o7/icon/lucide';
  import { Language, Map, CenterFocusWeak } from '@o7/icon/material';
  import type { VisitedCountryStatus } from '$lib/db/types';

  const visitedCountriesResult = trpc.visitedCountries.list.query();
  const visitedCountries = $derived.by(
    () => $visitedCountriesResult.data || [],
  );
  const getCountry = (code: number) =>
    visitedCountries.find((c) => c.code === code);

  let globe = $state(true);
  const projection = $derived(globe ? geoOrthographic : geoNaturalEarth1);

  const geojson = feature(COUNTRIES_GEO, COUNTRIES_GEO.objects.countries);
  const features = geojson.features;

  let transform: TransformContext | undefined = $state(undefined);
  let width = $state(0);
  let height = $state(0);
  $effect(() => {
    if (!transform || width === 0 || height === 0) return;

    const result = geoFitObjectTransform(
      projection(),
      // Padding
      [width - 100, height - 100],
      geojson,
    );
    transform.setScale(result.scale);
  });

  let editing = $state(false);
  let editingInfo: {
    id: number;
    status: (typeof VisitedCountryStatus)[number] | null;
    note: string | null;
  } | null = $state(null);
  const editCountry = (id: number) => {
    const country = getCountry(id);

    editingInfo = {
      id,
      status: country?.status ?? null,
      note: country?.note ?? null,
    };
    editing = true;
  };
</script>

<svelte:window bind:innerWidth={width} bind:innerHeight={height} />

<SetupVisitedCountries {visitedCountries} />
<EditVisitedCountry bind:open={editing} {editingInfo} />

<div class="flex flex-col h-full">
  <Chart
    geo={{
      projection,
      fitGeojson: geojson,
      applyTransform: ['scale', 'rotate'],
    }}
    transform={{
      initialScrollMode: 'scale',
    }}
    let:tooltip
    bind:transformContext={transform}
  >
    {@render topLeftPanel()}
    {@render topRightPanel()}

    <Svg>
      <GeoPath
        geojson={{ type: 'Sphere' }}
        class="fill-blue-400/50 dark:fill-none stroke-surface-content"
      />
      <Graticule class="stroke-surface-content/20 pointer-events-none" />
      {#each features as feature}
        {@const country = getCountry(+feature.id)}
        <GeoPath
          on:click={() => feature.id && editCountry(+feature.id)}
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
        {getCountry(+data.id)?.note}
      </p>
    </Tooltip.Root>
  </Chart>
</div>

{#snippet topLeftPanel()}
  <div class="absolute left-10 top-10 z-10">
    <div
      class="bg-background/70 border rounded-2xl p-2 backdrop-blur-md flex flex-col"
    >
      <Button
        onclick={() => transform?.zoomIn()}
        title="Zoom in"
        variant="ghost"
        size="icon"
      >
        <ZoomIn />
      </Button>
      <Button
        onclick={() => transform?.zoomOut()}
        title="Zoom out"
        variant="ghost"
        size="icon"
      >
        <ZoomOut />
      </Button>
      <!-- Changing width triggers fitting of globe to screen -->
      <Button
        onclick={() => (width -= 1)}
        title="Recenter"
        variant="ghost"
        size="icon"
      >
        <CenterFocusWeak />
      </Button>
      <Button
        onclick={() => (globe = !globe)}
        title={globe ? 'Switch to map' : 'Switch to globe'}
        variant="ghost"
        size="icon"
      >
        {#if globe}
          <Language />
        {:else}
          <Map />
        {/if}
      </Button>
    </div>
  </div>
{/snippet}

{#snippet topRightPanel()}
  <div class="absolute right-10 top-10 z-10">
    <div class="bg-background/70 border rounded-2xl p-5 backdrop-blur-md">
      <h5 class="text-sm font-medium">Legend</h5>
      {@render legendItem('bg-primary', 'Visited')}
      {@render legendItem('bg-green-400', 'Lived')}
      {@render legendItem('bg-tertiary', 'Layover')}
      {@render legendItem('bg-violet-500', 'Wishlist')}
    </div>
  </div>
{/snippet}

{#snippet legendItem(color, label)}
  <div class="flex items-center gap-2">
    <div class={cn('size-4 rounded-sm', color)} />
    <span class="text-sm">{label}</span>
  </div>
{/snippet}
