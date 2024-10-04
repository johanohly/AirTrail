<script lang="ts">
  import { Modal } from '$lib/components/ui/modal';
  import { Button } from '$lib/components/ui/button';
  import { api, trpc } from '$lib/trpc';

  let { visitedCountries }: { visitedCountries: any[] } = $props();

  let manualOverride = $state(false);
  let open = $derived.by(
    () => !manualOverride && visitedCountries.length === 0,
  );

  let loading = $state(false);
  const importFlights = async () => {
    loading = true;
    const success = await api.visitedCountries.importFlights.mutate();
    if (success) {
      await trpc.visitedCountries.list.utils.invalidate();
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
  <h1>Welcome to your globe</h1>
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
