<script lang="ts">
  import { Funnel, Locate, Waypoints, X } from '@o7/icon/lucide';

  import {
    closeMapDetails,
    focusAirportRoutes,
    focusMapDetails,
    mapDetailsState,
  } from '$lib/state.svelte';

  import DetailsActionButton from './DetailsActionButton.svelte';

  let {
    hasFilters,
    filterActive,
    onToggleFilter,
  }: {
    hasFilters: boolean;
    filterActive: boolean;
    onToggleFilter: () => void;
  } = $props();
</script>

<DetailsActionButton
  label="Locate airport"
  shortLabel="Locate"
  icon={Locate}
  onclick={focusMapDetails}
  pressed={mapDetailsState.airportFocusMode === 'airport'}
/>
<DetailsActionButton
  label="Locate airport routes"
  shortLabel="Routes"
  icon={Waypoints}
  onclick={focusAirportRoutes}
  pressed={mapDetailsState.airportFocusMode === 'routes'}
/>
{#if hasFilters}
  <DetailsActionButton
    label={filterActive ? 'Clear airport filter' : 'Filter map to airport'}
    shortLabel={filterActive ? 'Clear' : 'Filter'}
    icon={Funnel}
    onclick={onToggleFilter}
    pressed={filterActive}
  />
{/if}
<DetailsActionButton
  label="Close details"
  shortLabel="Close"
  icon={X}
  onclick={closeMapDetails}
/>
