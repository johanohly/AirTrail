<script lang="ts">
  import { LoaderCircle } from '@o7/icon/lucide';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Label } from '$lib/components/ui/label';

  let {
    showAirlineFromFlightNumber = false,
    showFilterOwner = false,
    ownerOnly = $bindable(false),
    matchAirlineFromFlightNumber = $bindable(true),
    dedupeImportedFlights = $bindable(true),
    importing = false,
    canImport = false,
    onback,
    onimport,
  }: {
    showAirlineFromFlightNumber?: boolean;
    showFilterOwner?: boolean;
    ownerOnly?: boolean;
    matchAirlineFromFlightNumber?: boolean;
    dedupeImportedFlights?: boolean;
    importing?: boolean;
    canImport?: boolean;
    onback?: () => void;
    onimport?: () => void;
  } = $props();
</script>

<div class="space-y-2">
  <h3 class="text-sm font-medium">Options</h3>
  <Card class="p-3 space-y-2">
    {#if showAirlineFromFlightNumber}
      <div class="flex items-center gap-2">
        <Checkbox
          id="match-airline-from-flight-number"
          bind:checked={matchAirlineFromFlightNumber}
          aria-labelledby="match-airline-from-flight-number-label"
        />
        <Label
          id="match-airline-from-flight-number-label"
          for="match-airline-from-flight-number"
        >
          Match airline from flight number
        </Label>
      </div>
    {/if}
    {#if showFilterOwner}
      <div class="flex items-center gap-2">
        <Checkbox
          id="owner-only"
          bind:checked={ownerOnly}
          aria-labelledby="owner-only-label"
        />
        <Label id="owner-only-label" for="owner-only"
          >Only import your flights</Label
        >
      </div>
    {/if}
    <div class="flex items-center gap-2">
      <Checkbox
        id="dedupe-imported-flights"
        bind:checked={dedupeImportedFlights}
        aria-labelledby="dedupe-imported-flights-label"
      />
      <Label id="dedupe-imported-flights-label" for="dedupe-imported-flights">
        Deduplicate imported flights
      </Label>
    </div>
  </Card>
  <div class="mt-4 flex justify-between">
    <Button variant="secondary" onclick={() => onback?.()}>Back</Button>
    <Button onclick={() => onimport?.()} disabled={!canImport || importing}>
      {#if importing}
        <LoaderCircle class="animate-spin mr-1" size={16} />
      {/if}
      Import
    </Button>
  </div>
</div>
