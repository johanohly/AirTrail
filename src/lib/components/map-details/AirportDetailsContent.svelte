<script lang="ts">
  import { Funnel, Locate, X } from '@o7/icon/lucide';

  import AirportFlightsCard from '$lib/components/airport-details/AirportFlightsCard.svelte';
  import AirportStatsCard from '$lib/components/airport-details/AirportStatsCard.svelte';
  import AirportTimeCard from '$lib/components/airport-details/AirportTimeCard.svelte';
  import AirportWeatherCard from '$lib/components/airport-details/AirportWeatherCard.svelte';
  import type {
    FlightFilters,
    TempFilters,
  } from '$lib/components/flight-filters/types';
  import {
    setTempArrivalAirport,
    setTempDepartureAirport,
  } from '$lib/components/flight-filters/types';
  import { Button } from '$lib/components/ui/button';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import {
    closeMapDetails,
    focusFlightInList,
    focusMapDetails,
    mapDetailsState,
    openModalsState,
  } from '$lib/state.svelte';
  import { prepareVisitedAirports, type FlightData } from '$lib/utils';

  import MapDetailsFrame from './MapDetailsFrame.svelte';

  let {
    flights,
    filters = $bindable(),
    tempFilters = $bindable(),
  }: {
    flights: FlightData[];
    filters?: FlightFilters;
    tempFilters?: TempFilters;
  } = $props();

  const selectedAirportId = $derived.by(() => {
    const selection = mapDetailsState.selection;
    return selection?.type === 'airport' ? selection.airportId : null;
  });

  const visited = $derived(prepareVisitedAirports(flights));

  const airport = $derived.by(() => {
    const id = selectedAirportId;
    if (id === null) return null;
    return visited.find((a) => a.id === id) ?? null;
  });

  const relatedFlights = $derived.by(() => {
    const id = selectedAirportId;
    if (id === null) return [];
    return flights.filter((f) => f.from?.id === id || f.to?.id === id);
  });

  const airportFilterActive = $derived.by(() => {
    if (!filters || !airport) return false;
    return (
      filters.airportsEither.length === 1 &&
      filters.airportsEither[0] === airport.id.toString() &&
      filters.departureAirports.length === 0 &&
      filters.arrivalAirports.length === 0 &&
      filters.routes.length === 0
    );
  });

  const toggleAirportFilter = () => {
    if (!filters || !airport) return;

    if (airportFilterActive) {
      filters.airportsEither = [];
      return;
    }

    filters.departureAirports = [];
    filters.arrivalAirports = [];
    filters.routes = [];
    filters.airportsEither = [airport.id.toString()];
  };

  const showDepartures = (flightId?: number) => {
    if (!airport) return;
    if (tempFilters)
      setTempDepartureAirport(tempFilters, airport.id.toString());
    if (flightId) focusFlightInList(flightId);
    openModalsState.listFlights = true;
  };

  const showArrivals = (flightId?: number) => {
    if (!airport) return;
    if (tempFilters) setTempArrivalAirport(tempFilters, airport.id.toString());
    if (flightId) focusFlightInList(flightId);
    openModalsState.listFlights = true;
  };
</script>

{#snippet header()}
  {#if airport}
    <div class="flex items-start gap-3 px-4 py-4">
      <img
        src="https://flagcdn.com/{airport.country.toLowerCase()}.svg"
        alt={airport.country}
        class="h-8 w-11 shrink-0 rounded object-cover shadow-sm"
      />
      <div class="min-w-0 flex-1">
        <div class="flex items-baseline gap-1.5">
          <span class="text-2xl leading-none font-semibold tracking-tight">
            {airport.iata ?? airport.icao}
          </span>
          {#if airport.iata}
            <span class="font-mono text-xs leading-none text-muted-foreground">
              {airport.icao}
            </span>
          {/if}
        </div>
        <h2 class="mt-1 truncate text-sm leading-tight font-medium">
          {airport.name}
        </h2>
        <p class="mt-0.5 truncate text-xs text-muted-foreground">
          {airport.municipality
            ? `${airport.municipality}, ${airport.country}`
            : airport.country}
        </p>
      </div>
    </div>
  {/if}
{/snippet}

{#snippet actionButton(
  label: string,
  Icon: typeof Locate,
  onclick: () => void,
  pressed = false,
)}
  <Tooltip.Root delayDuration={0} disableHoverableContent>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        <Button
          {...props}
          variant={pressed ? 'secondary' : 'ghost'}
          size="sm"
          class="h-9 flex-1 px-2 md:size-8 md:flex-none md:px-0"
          {onclick}
          aria-label={label}
          aria-pressed={pressed || undefined}
        >
          <Icon size={16} />
          <span class="text-xs md:sr-only">{label}</span>
        </Button>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Content side="right" sideOffset={8} class="hidden md:block">
        {label}
      </Tooltip.Content>
    </Tooltip.Portal>
  </Tooltip.Root>
{/snippet}

{#snippet actions()}
  {#if airport}
    {@render actionButton('Locate airport', Locate, focusMapDetails)}
    {#if filters}
      {@render actionButton(
        airportFilterActive ? 'Clear airport filter' : 'Filter map to airport',
        Funnel,
        toggleAirportFilter,
        airportFilterActive,
      )}
    {/if}
    {@render actionButton('Close details', X, closeMapDetails)}
  {/if}
{/snippet}

{#snippet body()}
  {#if airport}
    <AirportStatsCard
      flights={relatedFlights}
      airportId={airport.id}
      airlineCount={airport.airlines.length}
    />
    <AirportTimeCard tz={airport.tz} />
    <AirportWeatherCard icao={airport.icao} tz={airport.tz} lon={airport.lon} />
    <AirportFlightsCard
      flights={relatedFlights}
      airportId={airport.id}
      onShowAllDepartures={showDepartures}
      onShowAllArrivals={showArrivals}
    />
  {/if}
{/snippet}

<MapDetailsFrame
  open={!!airport}
  {header}
  {actions}
  onOpenChange={(v) => {
    if (!v) closeMapDetails();
  }}
>
  {@render body()}
</MapDetailsFrame>
