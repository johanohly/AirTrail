<script lang="ts">
  import {
    calculateBounds,
    prepareFlightArcData,
    type FlightData,
    kmToMiles,
    pluralize,
  } from '$lib/utils/index.js';
  import {
    AttributionControl,
    Control,
    ControlButton,
    ControlGroup,
    DeckGlLayer,
    GeolocateControl,
    MapLibre,
    NavigationControl,
    Popup,
  } from 'svelte-maplibre';
  import { ArcLayer } from '@deck.gl/layers';
  import { Home } from '@o7/icon/material';
  import maplibregl from 'maplibre-gl';
  import { mode } from 'mode-watcher';
  import { OnResizeEnd } from '$lib/components/helpers';
  import { Airports } from '.';
  import { page } from '$app/stores';
  import { formatAsDate } from '$lib/utils/datetime/index.js';
  import NumberFlow from '@number-flow/svelte';

  const FROM_COLOR = [59, 130, 246]; // Also the primary color
  const TO_COLOR = [139, 92, 246]; // TW violet-500
  const HOVER_COLOR = [16, 185, 129];
  const FUTURE_COLOR = [102, 217, 239, 100];

  let {
    flights,
  }: {
    flights: FlightData[];
  } = $props();

  const metric = $derived($page.data.user?.unit !== 'imperial');

  let map: maplibregl.Map | undefined = $state(undefined);
  const style = $derived(
    $mode === 'light'
      ? 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
      : 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  );

  const flightArcs = $derived.by(() => {
    return prepareFlightArcData(flights);
  });

  const fitFlights = () => {
    if (!map || !flightArcs) return;

    const bounds = calculateBounds(flightArcs);
    if (!bounds) return;

    map.fitBounds(bounds, {
      padding: 120,
    });
  };

  // Fit flights whenever the flights change
  $effect(() => {
    fitFlights();
  });

  let hoveredArc = $state.raw(null); // required so that we can compare against non-proxies object
</script>

<OnResizeEnd callback={fitFlights} />

<MapLibre
  on:load={() => fitFlights()}
  bind:map
  {style}
  diffStyleUpdates
  class="relative h-full"
  attributionControl={false}
>
  <AttributionControl compact={true} />
  <NavigationControl />
  <GeolocateControl />
  {#if flightArcs.length}
    <Control position="top-left">
      <ControlGroup>
        <ControlButton
          on:click={() => fitFlights()}
          title="Show all flights"
          class="text-black"
        >
          <Home />
        </ControlButton>
      </ControlGroup>
    </Control>
  {/if}

  <Airports {flights} />

  <DeckGlLayer
    type={ArcLayer}
    data={flightArcs}
    getSourcePosition={(d) => d.from.position}
    getTargetPosition={(d) => d.to.position}
    getSourceColor={(d) =>
      hoveredArc && d === hoveredArc
        ? HOVER_COLOR
        : d.exclusivelyFuture
          ? FUTURE_COLOR
          : FROM_COLOR}
    getTargetColor={(d) =>
      hoveredArc && d === hoveredArc
        ? HOVER_COLOR
        : d.exclusivelyFuture
          ? FUTURE_COLOR
          : TO_COLOR}
    updateTriggers={{ getSourceColor: hoveredArc, getTargetColor: hoveredArc }}
    getWidth={2}
    getHeight={0}
    greatCircle={true}
  />
  <DeckGlLayer
    bind:hovered={hoveredArc}
    type={ArcLayer}
    data={flightArcs}
    getSourcePosition={(d) => d.from.position}
    getTargetPosition={(d) => d.to.position}
    getSourceColor={[0, 0, 0, 0]}
    getTargetColor={[0, 0, 0, 0]}
    getWidth={3 * 6}
    getHeight={0}
    greatCircle={true}
  >
    <Popup openOn="hover" anchor="top-left" offset={12} let:data>
      <div class="flex flex-col px-3 pt-3">
        <h3 class="font-thin text-muted-foreground">Route</h3>
        <h4 class="flex items-center text-lg">
          <img
            src="https://flagcdn.com/{data.from.country.toLowerCase()}.svg"
            alt={data.from.country}
            class="w-8 h-5 mr-2"
          />
          {data.from.iata} - {data.from.name}
        </h4>
        <h4 class="flex items-center text-lg">
          <img
            src="https://flagcdn.com/{data.to.country.toLowerCase()}.svg"
            alt={data.to.country}
            class="w-8 h-5 mr-2"
          />
          {data.to.iata} - {data.to.name}
        </h4>
      </div>
      <div class="h-[1px] bg-muted my-3" />
      <div class="grid grid-cols-[repeat(3,_1fr)] px-3">
        <h4 class="font-semibold">
          <NumberFlow
            value={Math.round(
              metric ? data.distance : kmToMiles(data.distance),
            )}
          />
          <span class="font-thin text-muted-foreground"
            >{metric ? 'km' : 'mi'}</span
          >
        </h4>
        <h4 class="font-semibold">
          <NumberFlow value={data.flights.length} />
          <span class="font-thin text-muted-foreground"
            >{pluralize(data.flights.length, 'trip')}</span
          >
        </h4>
        <h4 class="font-semibold">
          <NumberFlow value={data.airlines.length} />
          <span class="font-thin text-muted-foreground"
            >{pluralize(data.airlines.length, 'airline')}</span
          >
        </h4>
      </div>
      <div class="h-[1px] bg-muted my-3" />
      <div class="px-3 pb-3">
        <div class="grid grid-cols-[repeat(3,_1fr)]">
          <h3 class="font-semibold">Route</h3>
          <h3 class="font-semibold">Date</h3>
          <h3 class="font-semibold">Airline</h3>
        </div>
        {#each data.flights.slice(0, 5) as flight}
          <div class="grid grid-cols-[repeat(3,_1fr)]">
            <h4 class="font-thin">{flight.route}</h4>
            <h4 class="font-thin">{formatAsDate(flight.date, true, true)}</h4>
            <h4 class="font-thin">{flight.airline}</h4>
          </div>
        {/each}
        {#if data.flights.length > 5}
          <h4 class="font-thin text-muted-foreground">
            +{data.flights.length - 5} more
          </h4>
        {/if}
      </div>
    </Popup>
  </DeckGlLayer>

  <!-- Both the size and sizeScale don't really matter a lot, the main values are the maxPixels and minPixels, because the unit is meters -->
  <!-- <DeckGlLayer
    type={IconLayer}
    data={AIRPORTS.filter(
        (d) => !visitedAirports.some((v) => v.name === d.name),
      )}
    getPosition={(d) => [d.lon, d.lat]}
    getIcon={(d) => 'marker'}
    getColor={[255, 255, 255]}
    getSize={(d) => linearClamped(d.tier, 4, 18, 50, 100)}
    sizeScale={10}
    sizeMinPixels={0}
    sizeMaxPixels={30}
    sizeUnits="meters"
    iconAtlas="https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/icon-atlas.png"
    iconMapping="https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/icon-atlas.json"
  >
    <Popup openOn="click" let:data>
      {data.name}
    </Popup>
  </DeckGlLayer>
  -->
</MapLibre>
