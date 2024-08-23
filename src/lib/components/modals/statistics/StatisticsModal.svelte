<script lang="ts">
  import type { Readable } from 'svelte/store';
  import type { APIFlight } from '$lib/db';
  import { Modal } from '$lib/components/ui/modal';
  import FlightsPerMonth from './charts/FlightsPerMonth.svelte';

  let {
    open = $bindable(),
    flights,
  }: {
    open?: boolean;
    flights: Readable<{ data: APIFlight[] | undefined }>;
  } = $props();
</script>

<Modal bind:open classes="!w-[calc(100dvw-4rem)] overflow-y-auto" dialogOnly>
  <div class="flex gap-4">
    <FlightsPerMonth {flights} />
    <FlightsPerMonth {flights} />
  </div>
</Modal>
