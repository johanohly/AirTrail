<script lang="ts">
  import { MapPin } from '@o7/icon/lucide';
  import maplibregl, { type LngLatLike } from 'maplibre-gl';
  import { mode } from 'mode-watcher';
  import {
    AttributionControl,
    FullscreenControl,
    GeolocateControl,
    MapLibre,
    Marker,
    type MarkerClickInfo,
    NavigationControl,
  } from 'svelte-maplibre';
  import type { Infer, SuperForm } from 'sveltekit-superforms';

  import * as Form from '$lib/components/ui/form';
  import * as Select from '$lib/components/ui/select';
  import { COUNTRIES } from '$lib/data/countries';
  import { Continents, ContinentMap } from '$lib/db/types';
  import { cn } from '$lib/utils';
  import { countryFromAlpha } from '$lib/utils/data/countries';
  import type { airportSchema } from '$lib/zod/airport';

  const { form }: { form: SuperForm<Infer<typeof airportSchema>> } = $props();

  const { form: formData, errors } = form;

  let map: maplibregl.Map | undefined = $state(undefined);
  const style = $derived(
    $mode === 'light'
      ? 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
      : 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  );

  let marker: LngLatLike | null = $state(
    !$formData.lon && !$formData.lat
      ? null
      : {
          lng: $formData.lon,
          lat: $formData.lat,
        },
  );
  const markLocation = (e: maplibregl.MapMouseEvent) => {
    marker = e.lngLat;
    const { lng, lat } = e.lngLat;
    $formData.lon = lng;
    $formData.lat = lat;
  };

  const onDrag = (e: MarkerClickInfo) => {
    marker = e.lngLat;
    const [lng, lat] = e.lngLat;
    $formData.lon = lng;
    $formData.lat = lat;
  };
</script>

<span
  class={cn('text-sm font-medium leading-none', {
    'text-destructive': $errors.lat || $errors.lon,
  })}>Location *</span
>
<MapLibre
  bind:map
  onclick={markLocation}
  {style}
  diffStyleUpdates
  cooperativeGestures
  class="relative aspect-[9/16] max-h-[70vh] w-full sm:aspect-video sm:max-h-full"
  attributionControl={false}
>
  {#if marker}
    <Marker ondrag={onDrag} lngLat={marker} draggable>
      <MapPin class="text-primary" size={42} />
    </Marker>
  {/if}

  <AttributionControl compact={true} />
  <NavigationControl />
  <GeolocateControl />
  <FullscreenControl position="top-right" />
</MapLibre>
<div class="text-muted-foreground text-sm">
  Click on the map to set the location of the airport. Drag the marker to adjust
  the location.
</div>
{#if $errors.lat || $errors.lon}
  <div class="text-destructive text-sm font-medium">
    Please select a location on the map.
  </div>
{/if}

<section class="grid grid-cols-2 gap-2">
  <Form.Field {form} name="country">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Country</Form.Label>
        <Select.Root
          bind:value={$formData.country}
          name={props.name}
          type="single"
        >
          <Select.Trigger {...props}>
            {$formData.country
              ? countryFromAlpha($formData.country)?.name
              : 'Select a country'}
          </Select.Trigger>
          <Select.Content>
            {#each COUNTRIES as country}
              <Select.Item value={country.alpha} label={country.name} />
            {/each}
          </Select.Content>
        </Select.Root>
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <Form.Field {form} name="continent">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Continent</Form.Label>
        <Select.Root
          bind:value={$formData.continent}
          name={props.name}
          type="single"
        >
          <Select.Trigger {...props}>
            {$formData.continent
              ? ContinentMap[$formData.continent]
              : 'Select a continent'}
          </Select.Trigger>
          <Select.Content>
            {#each Continents as continent}
              <Select.Item value={continent} label={ContinentMap[continent]} />
            {/each}
          </Select.Content>
        </Select.Root>
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
</section>
