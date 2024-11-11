<script lang="ts">
  import { kmToMiles, pluralize, prepareFlightArcData } from '$lib/utils';
  import { formatAsDate } from '$lib/utils/datetime';
  import { DeckGlLayer, Popup } from 'svelte-maplibre';
  import { ArcLayer } from '@deck.gl/layers';
  import NumberFlow from '@number-flow/svelte';
  import { page } from '$app/stores';

  const FROM_COLOR = [59, 130, 246]; // Also the primary color
  const TO_COLOR = [139, 92, 246]; // TW violet-500
  const HOVER_COLOR = [16, 185, 129];
  const FUTURE_COLOR = [102, 217, 239, 100];

  let {
    flightArcs,
  }: {
    flightArcs: ReturnType<typeof prepareFlightArcData>;
  } = $props();

  const metric = $derived($page.data.user?.unit !== 'imperial');

  let hoveredArc = $state.raw(null); // required so that we can compare against non-proxies object
</script>

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
          value={Math.round(metric ? data.distance : kmToMiles(data.distance))}
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
