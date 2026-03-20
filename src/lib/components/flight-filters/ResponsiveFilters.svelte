<script lang="ts">
  import { Funnel } from '@o7/icon/lucide';

  import Filters from './Filters.svelte';

  import type {
    FlightFilters,
    TempFilters,
  } from '$lib/components/flight-filters/types';
  import { Button } from '$lib/components/ui/button';
  import * as Popover from '$lib/components/ui/popover';
  import type { FlightData } from '$lib/utils';

  let {
    flights,
    filters = $bindable(),
    tempFilters = $bindable(),
    hasTempFilters = false,
  }: {
    flights: FlightData[];
    filters: FlightFilters;
    tempFilters?: TempFilters;
    hasTempFilters?: boolean;
  } = $props();

  let open = $state(false);
</script>

<div class="hidden gap-2 xl:flex">
  <Filters {flights} bind:filters bind:tempFilters {hasTempFilters} />
</div>

<Popover.Root bind:open>
  <Popover.Trigger>
    {#snippet child({ props })}
      <Button
        variant="outline"
        size="sm"
        class="gap-2 xl:hidden"
        {...props}
        disabled={flights.length === 0}
      >
        <Funnel size={16} />
        <span class="max-sm:hidden">Filters</span>
      </Button>
    {/snippet}
  </Popover.Trigger>
  <Popover.Content class="flex flex-col grow-0 gap-2 w-fit">
    <Filters {flights} bind:filters bind:tempFilters {hasTempFilters} />
  </Popover.Content>
</Popover.Root>
