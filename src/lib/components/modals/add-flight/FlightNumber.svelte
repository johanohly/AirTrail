<script lang="ts">
  import { tz } from '@date-fns/tz';
  import { format, isToday, parseJSON } from 'date-fns';
  import { toast } from 'svelte-sonner';
  import type { SuperForm } from 'sveltekit-superforms';
  import { z } from 'zod';

  import { Button } from '$lib/components/ui/button';
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import type { FlightLookupResultItem } from '$lib/server/utils/flight-lookup/flight-lookup';
  import { api } from '$lib/trpc';
  import {
    dateValueFromISO,
    formatAsTime,
    formatRelativeDate,
    isUsingAmPm,
  } from '$lib/utils/datetime';
  import type { flightSchema } from '$lib/zod/flight';
  import { appConfig } from '$lib/state.svelte';
  import { HelpTooltip } from '$lib/components/ui/tooltip';

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
    $formData.aircraft = aircraft?.icao ?? null;
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

    // Sort results: Today first (by time), then others by full datetime ascending (older first)
    const sorted = results.slice().sort((a, b) => {
      const da = getPrimaryDate(a);
      const db = getPrimaryDate(b);

      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;

      const aToday = isToday(da);
      const bToday = isToday(db);
      if (aToday !== bToday) return aToday ? -1 : 1;

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
</Form.Field>

{#if lookupResults && lookupResults.length > 1}
  <div
    class="mt-3 rounded-md border bg-card text-card-foreground overflow-hidden"
  >
    <div class="flex items-center justify-between p-3 border-b">
      <div class="font-medium">Select a flight</div>
      <Button variant="ghost" onclick={clearResults}>Clear</Button>
    </div>
    <ul class="divide-y">
      {#each lookupResults as r, i (i)}
        <li class="p-3 flex items-center gap-3 justify-between">
          <div class="min-w-0">
            <div class="text-sm font-medium truncate">
              {r.airline?.name ?? r.airline?.icao ?? 'Airline unknown'} — {r
                .from?.code ?? '?'} → {r.to?.code ?? '?'}
            </div>
            {#if r.departure && r.arrival}
              <div class="text-xs text-muted-foreground truncate">
                {formatRelativeDate(getPrimaryDate(r))}
                {formatRelativeDate(getPrimaryDate(r)) ? ' · ' : ''}
                {formatAsTime(r.departure)} → {formatAsTime(r.arrival)}
              </div>
            {/if}
            {#if r.from?.name || r.to?.name}
              <div class="text-xs text-muted-foreground truncate">
                {r.from?.name ?? ''}{r.from?.name && r.to?.name ? ' · ' : ''}{r
                  .to?.name ?? ''}
              </div>
            {/if}
          </div>
          <Button size="sm" onclick={() => applyLookupResult(r)}>Use</Button>
        </li>
      {/each}
    </ul>
  </div>
{/if}
