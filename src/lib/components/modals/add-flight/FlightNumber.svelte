<script lang="ts">
  import { toast } from 'svelte-sonner';
  import type { SuperForm } from 'sveltekit-superforms';
  import { z } from 'zod';

  import { Button } from '$lib/components/ui/button';
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import type { FlightLookupResultItem } from '$lib/server/utils/flight-lookup/flight-lookup';
  import { api } from '$lib/trpc';
  import type { flightSchema } from '$lib/zod/flight';

  let {
    form,
  }: {
    form: SuperForm<z.infer<typeof flightSchema>>;
  } = $props();
  const { form: formData } = form;

  let lookupResults: FlightLookupResultItem[] | null = $state(null);
  let isSearching = $state(false);

  function clearResults() {
    lookupResults = null;
  }

  function applyLookupResult(result: FlightLookupResultItem) {
    if (!result) return;
    const { from, to, airline } = result;

    if (
      ($formData.from.code !== '' || $formData.to.code !== '') &&
      !confirm(
        'Are you sure you want to overwrite the current flight information?',
      )
    ) {
      return;
    }

    $formData.from = from;
    $formData.to = to;
    $formData.airline = airline?.icao ?? null;
    clearResults();
    toast.success('Flight found');
  }

  const lookupFlight = async () => {
    if (!$formData.flightNumber) {
      return;
    }

    isSearching = true;
    clearResults();

    let results: FlightLookupResultItem[] = [];
    try {
      results = await api.flight.lookup.query({
        flightNumber: $formData.flightNumber,
        date: $formData.departure ?? undefined,
      });
    } catch (e) {
      toast.error(e.message ?? 'Error looking up flight');
      isSearching = false;
      return;
    }

    isSearching = false;

    if (!Array.isArray(results) || results.length === 0) {
      toast.error('Flight not found');
      return;
    }

    if (results.length === 1) {
      applyLookupResult(results[0]);
      return;
    }

    // Multiple results: let user choose below
    lookupResults = results;
    toast.info('Multiple flights found. Please choose one below.');
  };
</script>

<Form.Field {form} name="flightNumber">
  <Form.Control>
    {#snippet children({ props })}
      <Form.Label>Flight Number</Form.Label>
      <div class="grid grid-cols-[1fr_auto] gap-2">
        <Input
          bind:value={$formData.flightNumber}
          oninput={() => (lookupResults = null)}
          {...props}
        />
        <Button
          onclick={lookupFlight}
          disabled={!$formData.flightNumber || isSearching}
          variant="secondary"
          class="h-full"
          >{isSearching ? 'Searching...' : 'Search'}
        </Button>
      </div>

      {#if lookupResults && lookupResults.length > 1}
        <div class="mt-3 rounded-md border bg-card text-card-foreground">
          <div class="flex items-center justify-between p-3 border-b">
            <div class="font-medium">Select a flight</div>
            <Button variant="ghost" onclick={clearResults}>Clear</Button>
          </div>
          <ul class="divide-y">
            {#each lookupResults as r, i (i)}
              <li class="p-3 flex items-center gap-3 justify-between">
                <div class="min-w-0">
                  <div class="text-sm font-medium truncate">
                    {(r.airline?.name ?? r.airline?.icao ?? 'Airline unknown')} — {r.from?.code ?? '?'} → {r.to?.code ?? '?'}
                  </div>
                  {#if r.from?.name || r.to?.name}
                    <div class="text-xs text-muted-foreground truncate">
                      {(r.from?.name ?? '')}{r.from?.name && r.to?.name ? ' · ' : ''}{(r.to?.name ?? '')}
                    </div>
                  {/if}
                </div>
                <Button size="sm" onclick={() => applyLookupResult(r)}>Use</Button>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    {/snippet}
  </Form.Control>
</Form.Field>
