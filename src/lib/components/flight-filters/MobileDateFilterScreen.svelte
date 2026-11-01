<script lang="ts">
  import { page } from '$app/state';

  import DateFilterPanel from './DateFilterPanel.svelte';
  import { dateFilterSummary } from '$lib/components/flight-filters/model';
  import type { FlightFilters } from '$lib/components/flight-filters/types';
  import AnimatedSizeContainer from '$lib/components/ui/animated-size-container.svelte';
  import { getPreferences } from '$lib/utils/preferences';

  let {
    filters = $bindable(),
  }: {
    filters: FlightFilters;
  } = $props();

  const prefs = $derived(getPreferences(page.data.user));
</script>

<AnimatedSizeContainer height class="max-h-[72dvh]">
  <div class="max-h-[72dvh] overflow-y-auto p-4">
    <div class="mb-3 text-sm text-muted-foreground">
      {dateFilterSummary(filters, prefs)}
    </div>
    <DateFilterPanel bind:filters />
  </div>
</AnimatedSizeContainer>
