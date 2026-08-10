<script lang="ts">
  import { closeMapDetails, mapDetailsState } from '$lib/state.svelte';

  import MapDetailsFrame from './MapDetailsFrame.svelte';
  import RouteDetailsActions from './RouteDetailsActions.svelte';
  import RouteDetailsBody from './RouteDetailsBody.svelte';
  import RouteDetailsHeader from './RouteDetailsHeader.svelte';
  import type { useRouteDetails } from './useRouteDetails.svelte';

  let {
    details,
    hasFilters,
  }: {
    details: ReturnType<typeof useRouteDetails>;
    hasFilters: boolean;
  } = $props();
</script>

{#snippet header()}
  {#if details.routeAirports}
    <RouteDetailsHeader
      routeAirports={details.routeAirports}
      prefs={details.prefs}
      now={details.now}
      distance={details.distance}
    />
  {/if}
{/snippet}

{#snippet actions()}
  {#if details.routeAirports}
    <RouteDetailsActions
      {hasFilters}
      filterActive={details.routeFilterActive}
      onToggleFilter={details.toggleRouteFilter}
    />
  {/if}
{/snippet}

<MapDetailsFrame
  open={!!details.routeAirports}
  {header}
  {actions}
  onOpenChange={(v) => {
    if (!v && mapDetailsState.selection?.type === 'route') {
      closeMapDetails();
    }
  }}
>
  {#if details.routeAirports}
    <RouteDetailsBody
      routeFlights={details.routeFlights}
      airlineCount={details.airlineCount}
      distance={details.distance}
      lastFlownLabel={details.lastFlownLabel}
      prefs={details.prefs}
      onShowAll={details.showAllFlights}
      onShowFlight={details.showFlight}
    />
  {/if}
</MapDetailsFrame>
