<script lang="ts">
  import { ScatterplotLayer } from '@deck.gl/layers';
  import NumberFlow from '@number-flow/svelte';
  import { DeckGlLayer, Popup } from 'svelte-maplibre';

  import { INACTIVE_COLOR } from '$lib/components/map/index';
  import { hoverInfo } from '$lib/components/map/state.svelte';
  import {
    type FlightData,
    pluralize,
    prepareVisitedAirports,
  } from '$lib/utils';
  import { formatAsDate } from '$lib/utils/datetime/index.js';
  import { isSmallScreen } from '$lib/utils/size';

  //const AIRPORT_COLOR = [125, 211, 252]; // Tailwind blue-300
  const AIRPORT_COLOR = [16, 185, 129]; // Tailwind emerald-500

  let { flights }: { flights: FlightData[] } = $props();
  const visitedAirports = $derived.by(() => {
    const data = flights;
    if (!data || !data.length) return [];

    return prepareVisitedAirports(data);
  });
  type VisitedAirport = (typeof visitedAirports)[0];

  const getFillColor = () => {
    return (airport: (typeof visitedAirports)[number]) => {
      if (hoverInfo.hoveredAirport && hoverInfo.hoveredAirport.code === airport.code) {
        return [...AIRPORT_COLOR, 80];
      } else if (
        hoverInfo.hoveredAirport &&
        hoverInfo.hoveredAirport.flights.some((f) =>
          f.airports.includes(airport.code),
        )
      ) {
        return [...AIRPORT_COLOR, 50];
      } else if (
        hoverInfo.hoveredArc &&
        (hoverInfo.hoveredArc.from.code === airport.code ||
          hoverInfo.hoveredArc.to.code === airport.code)
      ) {
        return [...AIRPORT_COLOR, 50];
      } else if (hoverInfo.hoveredArc) {
        return [...INACTIVE_COLOR, 50];
      } else if (hoverInfo.hoveredAirport) {
        return [...INACTIVE_COLOR, 50];
      } else {
        return [...AIRPORT_COLOR, 50];
      }
    };
  };

  const getLineColor = () => {
    return (airport: (typeof visitedAirports)[number]) => {
      if (
        hoverInfo.hoveredAirport &&
        (hoverInfo.hoveredAirport.code === airport.code ||
          hoverInfo.hoveredAirport.flights.some((f) =>
            f.airports.includes(airport.code),
          ))
      ) {
        return [...AIRPORT_COLOR, 255];
      } else if (hoverInfo.hoveredAirport) {
        return INACTIVE_COLOR;
      } else if (
        hoverInfo.hoveredArc &&
        (hoverInfo.hoveredArc.from.code === airport.code ||
          hoverInfo.hoveredArc.to.code === airport.code)
      ) {
        return [...AIRPORT_COLOR, 255];
      } else if (hoverInfo.hoveredArc) {
        return INACTIVE_COLOR;
      } else {
        return [...AIRPORT_COLOR, 255];
      }
    };
  };
</script>

<DeckGlLayer
  bind:hovered={hoverInfo.hoveredAirport}
  type={ScatterplotLayer}
  data={visitedAirports}
  getPosition={(airport: VisitedAirport) => [airport.lon, airport.lat]}
  getRadius={(airport: VisitedAirport) => airport.frequency * 50_000}
  radiusMinPixels={$isSmallScreen ? 20 : 10}
  radiusMaxPixels={100}
  lineWidthUnits="pixels"
  getLineWidth={1}
  getFillColor={getFillColor()}
  getLineColor={getLineColor()}
  updateTriggers={{
    getFillColor: [hoverInfo.hoveredAirport, hoverInfo.hoveredArc],
    getLineColor: [hoverInfo.hoveredAirport, hoverInfo.hoveredArc],
  }}
  stroked
>
  <Popup openOn="hover" anchor="top-left" offset={20}>
    {#snippet children({ data }: { data: VisitedAirport })}
      <div class="min-w-[18rem]">
        <div class="flex flex-col px-3 pt-3">
          <h3 class="font-thin text-muted-foreground">Airport</h3>
          <h4 class="flex items-center text-lg">
            <img
              src="https://flagcdn.com/{data.country.toLowerCase()}.svg"
              alt={data.country}
              class="w-8 h-5 mr-2"
            />
            {data.iata ?? data.code} - {data.name}
          </h4>
        </div>
        <div class="h-[1px] bg-muted my-3" />
        <div class="grid grid-cols-[repeat(3,_1fr)] px-3">
          <h4 class="font-semibold">
            <NumberFlow value={data.departures} />
            <span class="font-thin text-muted-foreground"
              >{pluralize(data.departures, 'departure')}</span
            >
          </h4>
          <h4 class="font-semibold">
            <NumberFlow value={data.arrivals} />
            <span class="font-thin text-muted-foreground"
              >{pluralize(data.arrivals, 'arrival')}</span
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
      </div>
    {/snippet}
  </Popup>
</DeckGlLayer>
