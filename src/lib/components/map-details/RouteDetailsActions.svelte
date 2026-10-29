<script lang="ts">
  import { Funnel, Locate, Route, X } from '@o7/icon/lucide';

  import { closeMapDetails, focusMapDetails } from '$lib/state.svelte';

  import DetailsActionButton from './DetailsActionButton.svelte';

  let {
    hasFilters,
    filterActive,
    hasTrack,
    showingTrack,
    onToggleFilter,
    onToggle,
  }: {
    hasFilters: boolean;
    filterActive: boolean;
    hasTrack: boolean;
    showingTrack: boolean;
    onToggleFilter: () => void;
    onToggle: () => void;
  } = $props();
</script>

<DetailsActionButton
  label="Locate route"
  shortLabel="Locate"
  icon={Locate}
  onclick={focusMapDetails}
/>
{#if hasTrack}
  <DetailsActionButton
    label={showingTrack ? 'Show point-to-point route' : 'Show flight track'}
    shortLabel={showingTrack ? 'Direct' : 'Track'}
    icon={Route}
    onclick={onToggle}
    pressed={showingTrack}
  />
{/if}
{#if hasFilters}
  <DetailsActionButton
    label={filterActive ? 'Clear route filter' : 'Filter map to route'}
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
