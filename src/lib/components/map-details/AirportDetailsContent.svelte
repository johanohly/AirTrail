<script lang="ts">
  import { closeMapDetails, mapDetailsState } from '$lib/state.svelte';

  import AirportDetailsActions from './AirportDetailsActions.svelte';
  import AirportDetailsBody from './AirportDetailsBody.svelte';
  import AirportDetailsHeader from './AirportDetailsHeader.svelte';
  import MapDetailsFrame from './MapDetailsFrame.svelte';
  import type { useAirportDetails } from './useAirportDetails.svelte';

  let {
    details,
    hasFilters,
  }: {
    details: ReturnType<typeof useAirportDetails>;
    hasFilters: boolean;
  } = $props();
</script>

{#snippet header()}
  {#if details.airport}
    <AirportDetailsHeader airport={details.airport} />
  {/if}
{/snippet}

{#snippet actions()}
  {#if details.airport}
    <AirportDetailsActions
      {hasFilters}
      filterActive={details.airportFilterActive}
      onToggleFilter={details.toggleAirportFilter}
    />
  {/if}
{/snippet}

<MapDetailsFrame
  open={!!details.airport}
  {header}
  {actions}
  onOpenChange={(v) => {
    if (!v && mapDetailsState.selection?.type === 'airport') {
      closeMapDetails();
    }
  }}
>
  {#if details.airport}
    <AirportDetailsBody
      airport={details.airport}
      relatedFlights={details.relatedFlights}
      onShowDepartures={details.showDepartures}
      onShowArrivals={details.showArrivals}
    />
  {/if}
</MapDetailsFrame>
