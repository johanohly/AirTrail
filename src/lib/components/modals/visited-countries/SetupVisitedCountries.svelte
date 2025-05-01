<script lang="ts">
  import { toast } from 'svelte-sonner';

  import { Button } from '$lib/components/ui/button';
  import { Modal } from '$lib/components/ui/modal';
  import { api, trpc } from '$lib/trpc';

  let { countries }: { countries: any[] } = $props();

  let manualOverride = $state(false);
  let open = $derived.by(() => !manualOverride && countries.length === 0);

  let loading = $state(false);
  const importFlights = async () => {
    loading = true;
    const success = await api.visitedCountries.importFlights.mutate();
    if (success) {
      await trpc.visitedCountries.list.utils.invalidate();
    } else {
      toast.error('Failed to import flights (possibly due to no past flights)');
    }
    loading = false;
  };
</script>

<Modal
  {open}
  dialogOnly
  closeOnOutsideClick={false}
  closeOnEscape={false}
  closeButton={false}
>
  <h1 class="text-lg font-medium">Welcome to your globe</h1>
  <Button onclick={importFlights} disabled={loading}
    >Fill from your flights
  </Button>
  <Button
    onclick={() => (manualOverride = true)}
    variant="outline"
    disabled={loading}
    >Start from scratch
  </Button>
</Modal>
