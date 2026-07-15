<script lang="ts">
  import { closeMapDetails, mapDetailsState } from '$lib/state.svelte';

  import FlightDetailsActions from './FlightDetailsActions.svelte';
  import FlightDetailsBody from './FlightDetailsBody.svelte';
  import FlightDetailsHeader from './FlightDetailsHeader.svelte';
  import MapDetailsFrame from './MapDetailsFrame.svelte';
  import type { useFlightDetails } from './useFlightDetails.svelte';

  let {
    details,
    hasFilters,
    seatUserId,
  }: {
    details: ReturnType<typeof useFlightDetails>;
    hasFilters: boolean;
    seatUserId?: string;
  } = $props();
</script>

{#snippet header()}
  {#if details.flight}
    <FlightDetailsHeader
      flight={details.flight}
      onShowRoute={details.showRoute}
    />
  {/if}
{/snippet}

{#snippet actions()}
  {#if details.flight}
    <FlightDetailsActions
      {hasFilters}
      filterActive={details.flightFilterActive}
      onToggleFilter={details.toggleFlightFilter}
    />
  {/if}
{/snippet}

<MapDetailsFrame
  open={!!details.flight}
  {header}
  {actions}
  onOpenChange={(v) => {
    if (!v && mapDetailsState.selection?.type === 'flight') {
      closeMapDetails();
    }
  }}
>
  {#if details.flight}
    <FlightDetailsBody
      flight={details.flight}
      prefs={details.prefs}
      {seatUserId}
      onShowInList={details.showInList}
    />
  {/if}
</MapDetailsFrame>
