<script lang="ts">
  import FlightCard from './FlightCard.svelte';

  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Modal } from '$lib/components/ui/modal';
  import type { Airline, Airport } from '$lib/db/types';

  type Flight = {
    id: number;
    from: Airport | null;
    to: Airport | null;
    airline: Airline | null;
  };

  let {
    open = $bindable(false),
    flight,
    onConfirm,
  }: {
    open?: boolean;
    flight: Flight | null;
    onConfirm: () => void | Promise<void>;
  } = $props();

  let confirmationInput = $state('');
  let isDeleting = $state(false);

  const fromCode = $derived(flight?.from?.iata ?? flight?.from?.icao ?? 'N/A');
  const toCode = $derived(flight?.to?.iata ?? flight?.to?.icao ?? 'N/A');
  const confirmationCode = $derived(`${fromCode}-${toCode}`);
  const isConfirmed = $derived(
    confirmationInput.toUpperCase() === confirmationCode.toUpperCase(),
  );

  const handleDelete = async () => {
    if (!isConfirmed || isDeleting) return;
    isDeleting = true;
    try {
      await onConfirm();
      open = false;
      confirmationInput = '';
    } finally {
      isDeleting = false;
    }
  };

  // Reset input when modal closes
  $effect(() => {
    if (!open) {
      confirmationInput = '';
    }
  });
</script>

<Modal bind:open preset="alert">
  <div class="flex flex-col gap-4 min-w-0">
    <div class="flex flex-col gap-1">
      <h2 class="text-lg font-semibold">Delete flight</h2>
      <p class="text-sm text-muted-foreground">
        Are you sure you want to delete this flight?
      </p>
      <p class="text-sm text-muted-foreground">
        This action cannot be undone. All associated data will be permanently
        removed.
      </p>
    </div>

    <!-- Flight card -->
    {#if flight}
      <div class="rounded-lg border px-4 py-3 overflow-hidden">
        <FlightCard {flight} showMeta={false} />
      </div>
    {/if}

    <!-- Confirmation input -->
    <div class="flex flex-col gap-2">
      <label for="confirmation" class="text-sm">
        To verify, type <span class="font-semibold">{confirmationCode}</span> below
      </label>
      <Input
        id="confirmation"
        bind:value={confirmationInput}
        placeholder={confirmationCode}
        autocomplete="off"
      />
    </div>

    <!-- Actions -->
    <div class="flex justify-end gap-2 pt-2">
      <Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
      <Button
        variant="destructive"
        disabled={!isConfirmed || isDeleting}
        onclick={handleDelete}
      >
        {isDeleting ? 'Deleting...' : 'Delete flight'}
      </Button>
    </div>
  </div>
</Modal>
