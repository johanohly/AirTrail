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
  icon={Locate}
  onclick={focusMapDetails}
/>
{#if hasFilters}
  <DetailsActionButton
    label={filterActive ? 'Clear airport filter' : 'Filter map to airport'}
    icon={Funnel}
    onclick={onToggleFilter}
    pressed={filterActive}
  />
{/if}
<DetailsActionButton label="Close details" icon={X} onclick={closeMapDetails} />
