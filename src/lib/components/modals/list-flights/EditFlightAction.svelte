<script lang="ts">
  import { SquarePen } from '@o7/icon/lucide';

  import EditFlightModal from '../edit-flight/EditFlightModal.svelte';

  import { Button } from '$lib/components/ui/button';
  import type { FlightData } from '$lib/utils';

  let {
    flight,
    triggerDisabled = false,
  }: {
    flight: FlightData;
    triggerDisabled?: boolean;
  } = $props();

  let open = $state(false);
</script>

<Button
  variant="outline"
  size="icon"
  onclick={() => (open = true)}
  disabled={triggerDisabled}
  aria-label="Edit flight"
  title="Edit flight"
  data-testid="edit-flight-button"
>
  <SquarePen size={16} />
</Button>

{#key flight}
  <EditFlightModal {flight} bind:open showTrigger={false} />
{/key}
