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
  label="Locate route"
  shortLabel="Locate"
  icon={Locate}
  onclick={focusMapDetails}
/>
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
