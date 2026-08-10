<script lang="ts">
  import { Funnel, Locate, X } from '@o7/icon/lucide';

  import { closeMapDetails, focusMapDetails } from '$lib/state.svelte';

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
