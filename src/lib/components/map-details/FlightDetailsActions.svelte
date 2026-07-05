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
  label="Locate flight"
  icon={Locate}
  onclick={focusMapDetails}
/>
{#if hasFilters}
  <DetailsActionButton
    label={filterActive ? 'Show all flights' : 'Isolate flight on map'}
    icon={Funnel}
    onclick={onToggleFilter}
    pressed={filterActive}
  />
{/if}
<DetailsActionButton label="Close details" icon={X} onclick={closeMapDetails} />
