<script lang="ts">
  import FlightCard from './FlightCard.svelte';

  import { Button } from '$lib/components/ui/button';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Drawer from '$lib/components/ui/drawer';
  import { Input } from '$lib/components/ui/input';
  import type { Airline, Airport } from '$lib/db/types';
  import { isMediumScreen } from '$lib/utils/size';

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

  const handleOpenChange = (isOpen: boolean) => {
    open = isOpen;
    if (!isOpen) {
      confirmationInput = '';
    }
  };
</script>

{#snippet content()}
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
{/snippet}

{#if $isMediumScreen}
  <Dialog.Root open={open} onOpenChange={handleOpenChange}>
    <Dialog.Content class="max-w-md" closeButton={false}>
      {@render content()}
    </Dialog.Content>
  </Dialog.Root>
{:else}
  <Drawer.Root open={open} onOpenChange={handleOpenChange}>
    <Drawer.Content>
      {@render content()}
    </Drawer.Content>
  </Drawer.Root>
{/if}
