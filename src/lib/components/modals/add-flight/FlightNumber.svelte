<script lang="ts">
  import { tz } from '@date-fns/tz';
  import { format, isToday, parseJSON } from 'date-fns';
  import { toast } from 'svelte-sonner';
  import type { SuperForm } from 'sveltekit-superforms';
  import { z } from 'zod';

  import { Button } from '$lib/components/ui/button';
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import { HelpTooltip } from '$lib/components/ui/tooltip';
  import type { FlightLookupResultItem } from '$lib/server/utils/flight-lookup/flight-lookup';
  import { appConfig } from '$lib/state.svelte';
  import { api } from '$lib/trpc';
  import {
    formatAsTime,
    formatRelativeDate,
    isUsingAmPm,
  } from '$lib/utils/datetime';
  import type { flightSchema } from '$lib/zod/flight';

  const displayLocale = isUsingAmPm() ? 'en-US' : 'fr-FR';

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
    const { from, to, airline, aircraft, aircraftReg } = result;

    if (
      ($formData.from || $formData.to) &&
      !confirm(
        'Are you sure you want to overwrite the current flight information?',
      )
    ) {
      return;
    }

    $formData.from = from;
    $formData.to = to;
    $formData.airline = airline ?? null;
    $formData.aircraft = aircraft ?? null;
    $formData.aircraftReg = aircraftReg ?? null;

    if (result.arrival && result.departure) {
      $formData.departure = format(
        result.departure,
        "yyyy-MM-dd'T'00:00:00.000'Z'",
      );
      $formData.departureTime = formatAsTime(result.departure, displayLocale);

      $formData.arrival = format(
        result.arrival,
        "yyyy-MM-dd'T'00:00:00.000'Z'",
      );
      $formData.arrivalTime = formatAsTime(result.arrival, displayLocale);
    }

    clearResults();
    toast.success('Flight found');
  }

  function getPrimaryDate(item: FlightLookupResultItem): Date | null {
    return item.departure ?? item.arrival ?? null;
  }

  const lookupFlight = async () => {
    if (!$formData.flightNumber) {
      return;
    }

    isSearching = true;
    clearResults();

    let results: FlightLookupResultItem[] = [];
    try {
      const tempResults = await api.flight.lookup.query({
        flightNumber: $formData.flightNumber,
        date: $formData.departure ?? undefined,
      });
      results = tempResults.map((r) => ({
        ...r,
        departure: r.departure
          ? parseJSON(r.departure, { in: tz(r.departureTz) })
          : null,
        arrival: r.arrival
          ? parseJSON(r.arrival, { in: tz(r.arrivalTz) })
          : null,
      }));
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

    // Sort results by datetime ascending (oldest first)
    const sorted = results.slice().sort((a, b) => {
      const da = getPrimaryDate(a);
      const db = getPrimaryDate(b);

      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;

      return da.getTime() - db.getTime();
    });

    lookupResults = sorted;
    toast.info('Multiple flights found. Please choose one.');
  };
</script>

<Form.Field {form} name="flightNumber">
  <Form.Control>
    {#snippet children({ props })}
      <Form.Label class="flex gap-1">
        Flight Number
        {#if appConfig.configured?.integrations.aeroDataBoxKey}
          <HelpTooltip
            text="If you set the departure date before searching, it will be considered when searching for flights."
          />
        {/if}
      </Form.Label>
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
    {/snippet}
  </Form.Control>
  <Form.FieldErrors />
</Form.Field>

{#if lookupResults && lookupResults.length > 1}
  <div class="mt-3 space-y-2">
    <div
      class="flex items-center justify-between text-sm text-muted-foreground"
    >
      <span>Select your flight</span>
      <Button variant="ghost" size="sm" onclick={clearResults}>Clear</Button>
    </div>

    <div class="space-y-1.5">
      {#each lookupResults as r}
        {@const primaryDate = getPrimaryDate(r)}
        {@const isFlightToday = primaryDate && isToday(primaryDate)}
        <button
          onclick={() => applyLookupResult(r)}
          class="group w-full rounded-lg border bg-card p-3 text-left transition-all hover:border-primary hover:shadow-sm active:scale-[0.98] {isFlightToday
            ? 'border-primary/40 bg-primary/5'
            : ''}"
        >
          <div class="flex gap-3">
            <div
              class="flex flex-col items-center justify-center rounded-md border px-2.5 py-2 {isFlightToday
                ? 'border-primary/70 bg-primary text-primary-foreground shadow-sm'
                : 'border-border bg-muted/50'} flex-shrink-0"
            >
              {#if primaryDate}
                <div class="text-xl font-bold leading-none tabular-nums">
                  {format(primaryDate, 'd')}
                </div>
                <div
                  class="text-[10px] font-medium uppercase leading-none mt-0.5 opacity-80"
                >
                  {format(primaryDate, 'MMM')}
                </div>
              {:else}
                <div class="text-xs">?</div>
              {/if}
            </div>

            <div class="flex-1 min-w-0 space-y-0.5">
              <div class="flex items-baseline gap-1.5">
                {#if isFlightToday}
                  <span
                    class="rounded-sm bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground"
                  >
                    Today
                  </span>
                {:else if primaryDate}
                  <span class="text-xs font-medium text-muted-foreground">
                    {formatRelativeDate(primaryDate)}
                  </span>
                {/if}
              </div>

              <div class="font-semibold text-base leading-tight">
                {r.from?.iata ?? r.from?.icao ?? '?'} → {r.to?.iata ??
                  r.to?.icao ??
                  '?'}
              </div>

              {#if r.departure && r.arrival}
                <div
                  class="text-sm font-medium tabular-nums text-muted-foreground"
                >
                  {formatAsTime(r.departure)} – {formatAsTime(r.arrival)}
                </div>
              {/if}

              <div class="text-xs text-muted-foreground truncate">
                {r.airline?.name ?? r.airline?.icao ?? 'Unknown'}
              </div>
            </div>
          </div>
        </button>
      {/each}
    </div>
  </div>
{/if}
