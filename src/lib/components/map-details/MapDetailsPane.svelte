<script lang="ts">
  import type { FlightFilters } from '$lib/components/flight-filters/types';
  import type { NavigateFlights } from '$lib/flight-navigation';
  import { closeMapDetails, mapDetailsState } from '$lib/state.svelte';
  import type { FlightData } from '$lib/utils';
  import { isMediumScreen } from '$lib/utils/size';

  import AirportDetailsActions from './AirportDetailsActions.svelte';
  import AirportDetailsBody from './AirportDetailsBody.svelte';
  import AirportDetailsContent from './AirportDetailsContent.svelte';
  import AirportDetailsHeader from './AirportDetailsHeader.svelte';
  import FlightDetailsActions from './FlightDetailsActions.svelte';
  import FlightDetailsBody from './FlightDetailsBody.svelte';
  import FlightDetailsContent from './FlightDetailsContent.svelte';
  import FlightDetailsHeader from './FlightDetailsHeader.svelte';
  import MapDetailsFrame from './MapDetailsFrame.svelte';
  import RouteDetailsActions from './RouteDetailsActions.svelte';
  import RouteDetailsBody from './RouteDetailsBody.svelte';
  import RouteDetailsContent from './RouteDetailsContent.svelte';
  import RouteDetailsHeader from './RouteDetailsHeader.svelte';
  import { useAirportDetails } from './useAirportDetails.svelte';
  import { useFlightDetails } from './useFlightDetails.svelte';
  import { useRouteDetails } from './useRouteDetails.svelte';

  let {
    flights,
    filters = $bindable(),
    seatUserId,
    onNavigate,
  }: {
    flights: FlightData[];
    filters?: FlightFilters;
    seatUserId?: string;
    onNavigate: NavigateFlights;
  } = $props();

  const navigateFlights: NavigateFlights = (intent) => onNavigate(intent);

  const airport = useAirportDetails(
    () => flights,
    () => filters,
    navigateFlights,
  );

  const route = useRouteDetails(
    () => flights,
    () => filters,
    navigateFlights,
  );

  const flight = useFlightDetails(() => flights, navigateFlights);

  const mobileOpen = $derived.by(() => {
    const selection = mapDetailsState.selection;
    if (selection?.type === 'airport') return !!airport.airport;
    if (selection?.type === 'route') return !!route.routeAirports;
    if (selection?.type === 'flight') return !!flight.flight;
    return false;
  });
</script>

{#if $isMediumScreen}
  <AirportDetailsContent details={airport} hasFilters={!!filters} />
  <RouteDetailsContent details={route} hasFilters={!!filters} />
  <FlightDetailsContent details={flight} {seatUserId} />
{:else}
  {#snippet mobileHeader()}
    {#if mapDetailsState.selection?.type === 'airport' && airport.airport}
      <AirportDetailsHeader airport={airport.airport} />
    {:else if mapDetailsState.selection?.type === 'route' && route.routeAirports}
      <RouteDetailsHeader
        routeAirports={route.routeAirports}
        prefs={route.prefs}
        now={route.now}
        distance={route.distance}
      />
    {:else if mapDetailsState.selection?.type === 'flight' && flight.flight}
      <FlightDetailsHeader
        flight={flight.flight}
        onShowRoute={flight.showRoute}
      />
    {/if}
  {/snippet}

  {#snippet mobileActions()}
    {#if mapDetailsState.selection?.type === 'airport' && airport.airport}
      <AirportDetailsActions
        hasFilters={!!filters}
        filterActive={airport.airportFilterActive}
        onToggleFilter={airport.toggleAirportFilter}
      />
    {:else if mapDetailsState.selection?.type === 'route' && route.routeAirports}
      <RouteDetailsActions
        hasFilters={!!filters}
        filterActive={route.routeFilterActive}
        onToggleFilter={route.toggleRouteFilter}
      />
    {:else if mapDetailsState.selection?.type === 'flight' && flight.flight}
      <FlightDetailsActions />
    {/if}
  {/snippet}

  <MapDetailsFrame
    open={mobileOpen}
    header={mobileHeader}
    actions={mobileActions}
    onOpenChange={(v) => {
      if (!v) closeMapDetails();
    }}
  >
    {#if mapDetailsState.selection?.type === 'airport' && airport.airport}
      <AirportDetailsBody
        airport={airport.airport}
        relatedFlights={airport.relatedFlights}
        onShowDepartures={airport.showDepartures}
        onShowArrivals={airport.showArrivals}
      />
    {:else if mapDetailsState.selection?.type === 'route' && route.routeAirports}
      <RouteDetailsBody
        routeFlights={route.routeFlights}
        airlineCount={route.airlineCount}
        distance={route.distance}
        lastFlownLabel={route.lastFlownLabel}
        prefs={route.prefs}
        onShowAll={route.showAllFlights}
        onShowFlight={route.showFlight}
      />
    {:else if mapDetailsState.selection?.type === 'flight' && flight.flight}
      <FlightDetailsBody
        flight={flight.flight}
        prefs={flight.prefs}
        {seatUserId}
        onShowInList={flight.showInList}
      />
    {/if}
  </MapDetailsFrame>
{/if}
