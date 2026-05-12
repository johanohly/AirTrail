<script lang="ts">
  import type {
    FlightFilters,
    TempFilters,
  } from '$lib/components/flight-filters/types';
  import { closeMapDetails, mapDetailsState } from '$lib/state.svelte';
  import type { FlightData } from '$lib/utils';
  import { isMediumScreen } from '$lib/utils/size';

  import AirportDetailsActions from './AirportDetailsActions.svelte';
  import AirportDetailsBody from './AirportDetailsBody.svelte';
  import AirportDetailsContent from './AirportDetailsContent.svelte';
  import AirportDetailsHeader from './AirportDetailsHeader.svelte';
  import MapDetailsFrame from './MapDetailsFrame.svelte';
  import RouteDetailsActions from './RouteDetailsActions.svelte';
  import RouteDetailsBody from './RouteDetailsBody.svelte';
  import RouteDetailsContent from './RouteDetailsContent.svelte';
  import RouteDetailsHeader from './RouteDetailsHeader.svelte';
  import { useAirportDetails } from './useAirportDetails.svelte';
  import { useRouteDetails } from './useRouteDetails.svelte';

  let {
    flights,
    filters = $bindable(),
    tempFilters = $bindable(),
  }: {
    flights: FlightData[];
    filters?: FlightFilters;
    tempFilters?: TempFilters;
  } = $props();

  const airport = useAirportDetails(
    () => flights,
    () => filters,
    () => tempFilters,
  );

  const route = useRouteDetails(
    () => flights,
    () => filters,
    () => tempFilters,
  );
</script>

{#if $isMediumScreen}
  <AirportDetailsContent details={airport} hasFilters={!!filters} />
  <RouteDetailsContent details={route} hasFilters={!!filters} />
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
    {/if}
  {/snippet}

  <MapDetailsFrame
    open={!!mapDetailsState.selection}
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
      />
    {/if}
  </MapDetailsFrame>
{/if}
