<script lang="ts">
  import { Check, CircleAlert, ExternalLink } from '@o7/icon/lucide';

  import { page } from '$app/state';

  import AirlinePicker from '$lib/components/form-fields/AirlinePicker.svelte';
  import AirportPicker from '$lib/components/form-fields/AirportPicker.svelte';
  import AircraftPicker from '$lib/components/form-fields/AircraftPicker.svelte';
  import CreateAircraft from '$lib/components/modals/settings/pages/data-page/aircraft/CreateAircraft.svelte';
  import CreateAirline from '$lib/components/modals/settings/pages/data-page/airline/CreateAirline.svelte';
  import CreateAirport from '$lib/components/modals/settings/pages/data-page/airport/CreateAirport.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import { Separator } from '$lib/components/ui/separator';
  import type { Airline, Airport, Aircraft } from '$lib/db/types';
  import { pluralize } from '$lib/utils';
  import type { ImportFailure } from './';

  let {
    importedCount = 0,
    skippedRows = 0,
    importFailures = [],
    unknownAirports = {},
    unknownAirlines = {},
    unknownAircraft = {},
    busy = false,
    onreprocess,
    onclose,
  }: {
    importedCount?: number;
    skippedRows?: number;
    importFailures?: ImportFailure[];
    unknownAirports?: Record<string, number[]>;
    unknownAirlines?: Record<string, number[]>;
    unknownAircraft?: Record<string, number[]>;
    busy?: boolean;
    onreprocess?: (
      airportMapping: Record<string, Airport>,
      airlineMapping: Record<string, Airline>,
      aircraftMapping: Record<string, Aircraft>,
    ) => Promise<boolean>;
    onclose?: () => void;
  } = $props();

  const unknownAirportCodes = $derived(Object.keys(unknownAirports));
  const unknownAirlineCodes = $derived(Object.keys(unknownAirlines));
  const unknownAircraftCodes = $derived(Object.keys(unknownAircraft));

  let airportMapping: Record<string, Airport> = $state({});
  let airlineMapping: Record<string, Airline> = $state({});
  let aircraftMapping: Record<string, Aircraft> = $state({});

  const canReprocess = $derived(
    (Object.values(airportMapping).some(Boolean) ||
      Object.values(airlineMapping).some(Boolean) ||
      Object.values(aircraftMapping).some(Boolean)) &&
      !busy,
  );
  const mappedAirportCount = $derived(Object.keys(airportMapping).length);
  const mappedAirlineCount = $derived(Object.keys(airlineMapping).length);
  const mappedAircraftCount = $derived(Object.keys(aircraftMapping).length);
  const unmatchedCount = $derived(
    unknownAirportCodes.length +
      unknownAirlineCodes.length +
      unknownAircraftCodes.length,
  );
  const mappingSummary = $derived.by(() => {
    const summaries: string[] = [];

    if (mappedAirportCount > 0) {
      summaries.push(
        `${mappedAirportCount} of ${unknownAirportCodes.length} ${pluralize(
          unknownAirportCodes.length,
          'airport',
        )} mapped`,
      );
    }
    if (mappedAirlineCount > 0) {
      summaries.push(
        `${mappedAirlineCount} of ${unknownAirlineCodes.length} ${pluralize(
          unknownAirlineCodes.length,
          'airline',
        )} mapped`,
      );
    }
    if (mappedAircraftCount > 0) {
      summaries.push(
        `${mappedAircraftCount} of ${unknownAircraftCodes.length} ${pluralize(
          unknownAircraftCodes.length,
          'aircraft',
        )} mapped`,
      );
    }

    return summaries.join(' • ');
  });

  const isAdmin = $derived(page.data.user?.role !== 'user');

  let createAirport = $state(false);
  let createAirline = $state(false);
  let createAircraft = $state(false);

  const setAirportMapping = (code: string, airport: Airport | null) => {
    if (airport) {
      airportMapping[code] = airport;
    } else {
      delete airportMapping[code];
    }
  };

  const setAirlineMapping = (code: string, airline: Airline | null) => {
    if (airline) {
      airlineMapping[code] = airline;
    } else {
      delete airlineMapping[code];
    }
  };

  const setAircraftMapping = (code: string, aircraft: Aircraft | null) => {
    if (aircraft) {
      aircraftMapping[code] = aircraft;
    } else {
      delete aircraftMapping[code];
    }
  };

  const handleReprocess = async () => {
    const succeeded = await onreprocess?.(
      airportMapping,
      airlineMapping,
      aircraftMapping,
    );
    if (!succeeded) return;

    airportMapping = {};
    airlineMapping = {};
    aircraftMapping = {};
  };
</script>

<div class="space-y-4">
  <h3 class="text-sm font-medium">Import Status</h3>

  <Card class="p-4">
    <div class="flex items-start gap-3">
      {#if unmatchedCount > 0}
        <CircleAlert
          class="text-amber-600 dark:text-amber-500 mt-0.5 shrink-0"
          size={20}
        />
      {:else}
        <Check
          class="text-green-600 dark:text-green-500 mt-0.5 shrink-0"
          size={20}
        />
      {/if}
      <div class="flex-1">
        <p class="font-medium text-sm">
          {unmatchedCount > 0 ? 'Import Needs Mapping' : 'Import Complete'}
        </p>
        <p class="text-sm text-muted-foreground mt-0.5">
          {#if importedCount > 0}
            Successfully imported {importedCount}
            {pluralize(importedCount, 'flight')}
          {:else if unmatchedCount > 0}
            No flights were imported yet.
          {:else}
            No new flights were imported.
          {/if}
        </p>
      </div>
    </div>

    {#if skippedRows > 0}
      <Separator class="my-4" />

      <div class="flex items-start gap-3">
        <CircleAlert
          class="text-amber-600 dark:text-amber-500 mt-0.5 shrink-0"
          size={20}
        />
        <div class="flex-1">
          <p class="font-medium text-sm">
            {skippedRows} Skipped {pluralize(skippedRows, 'Row')}
          </p>
          <p class="text-sm text-muted-foreground mt-0.5">
            Could not be parsed. Check the browser console for details.
          </p>
        </div>
      </div>
    {/if}

    {#if importFailures.length > 0}
      <Separator class="my-4" />

      <div class="flex items-start gap-3">
        <CircleAlert class="text-destructive mt-0.5 shrink-0" size={20} />
        <div class="flex-1">
          <p class="font-medium text-sm">
            {importFailures.length} Validation
            {pluralize(importFailures.length, 'Error')}
          </p>
          <div class="text-sm text-muted-foreground mt-1 space-y-1">
            {#each importFailures.slice(0, 5) as failure (failure.index)}
              <p>
                Flight {failure.index + 1}: {failure.message}
              </p>
            {/each}
            {#if importFailures.length > 5}
              <p>
                Plus {importFailures.length - 5} more
                {pluralize(importFailures.length - 5, 'error')}.
              </p>
            {/if}
          </div>
        </div>
      </div>
    {/if}

    {#if unmatchedCount > 0}
      <Separator class="my-4" />

      <div class="flex items-start gap-3">
        <CircleAlert
          class="text-amber-600 dark:text-amber-500 mt-0.5 shrink-0"
          size={20}
        />
        <div class="flex-1">
          <p class="font-medium text-sm">
            {unmatchedCount} Unmatched {pluralize(unmatchedCount, 'Item')}
          </p>
          <p class="text-sm text-muted-foreground mt-0.5">
            Choose a match for each item you recognize, then re-import.
          </p>
        </div>
      </div>

      <ScrollArea class="h-[28dvh] mt-4 pr-2">
        <div class="space-y-3">
          {#if unknownAirportCodes.length}
            <div class="space-y-2">
              <p class="text-xs font-medium text-muted-foreground uppercase">
                Airports ({unknownAirportCodes.length})
              </p>
              {#each unknownAirportCodes as code (code)}
                <div
                  class="grid grid-cols-1 items-start gap-2 min-[440px]:grid-cols-[minmax(7rem,2fr)_minmax(0,3fr)] min-[440px]:gap-3"
                >
                  <div
                    class="flex min-h-9 min-w-0 items-center rounded-md border bg-muted/50 px-3 py-2"
                  >
                    <span
                      class="min-w-0 text-sm font-medium leading-5 [overflow-wrap:anywhere]"
                      title={code}>{code}</span
                    >
                  </div>
                  <div class="min-w-0">
                    <AirportPicker
                      placeholder="Search for airport..."
                      onchange={(airport) => setAirportMapping(code, airport)}
                      onCreateNew={isAdmin
                        ? () => (createAirport = true)
                        : undefined}
                      disabled={busy}
                      compact
                    />
                  </div>
                </div>
              {/each}
            </div>
          {/if}

          {#if unknownAirlineCodes.length}
            <div class="space-y-2" class:mt-4={unknownAirportCodes.length}>
              <p class="text-xs font-medium text-muted-foreground uppercase">
                Airlines ({unknownAirlineCodes.length})
              </p>
              {#each unknownAirlineCodes as code (code)}
                <div
                  class="grid grid-cols-1 items-start gap-2 min-[440px]:grid-cols-[minmax(7rem,2fr)_minmax(0,3fr)] min-[440px]:gap-3"
                >
                  <div
                    class="flex min-h-9 min-w-0 items-center rounded-md border bg-muted/50 px-3 py-2"
                  >
                    <span
                      class="min-w-0 text-sm font-medium leading-5 [overflow-wrap:anywhere]"
                      title={code}>{code}</span
                    >
                  </div>
                  <div class="min-w-0">
                    <AirlinePicker
                      placeholder="Search for airline..."
                      onchange={(airline) => setAirlineMapping(code, airline)}
                      onCreateNew={isAdmin
                        ? () => (createAirline = true)
                        : undefined}
                      disabled={busy}
                      compact
                    />
                  </div>
                </div>
              {/each}
            </div>
          {/if}

          {#if unknownAircraftCodes.length}
            <div
              class="space-y-2"
              class:mt-4={unknownAirportCodes.length ||
                unknownAirlineCodes.length}
            >
              <p class="text-xs font-medium text-muted-foreground uppercase">
                Aircraft ({unknownAircraftCodes.length})
              </p>
              {#each unknownAircraftCodes as code (code)}
                <div
                  class="grid grid-cols-1 items-start gap-2 min-[440px]:grid-cols-[minmax(7rem,2fr)_minmax(0,3fr)] min-[440px]:gap-3"
                >
                  <div
                    class="flex min-h-9 min-w-0 items-center rounded-md border bg-muted/50 px-3 py-2"
                  >
                    <span
                      class="min-w-0 text-sm font-medium leading-5 [overflow-wrap:anywhere]"
                      title={code}>{code}</span
                    >
                  </div>
                  <div class="min-w-0">
                    <AircraftPicker
                      placeholder="Search for aircraft..."
                      onchange={(aircraft) =>
                        setAircraftMapping(code, aircraft)}
                      onCreateNew={isAdmin
                        ? () => (createAircraft = true)
                        : undefined}
                      disabled={busy}
                      compact
                    />
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </ScrollArea>

      {#if mappedAirportCount > 0 || mappedAirlineCount > 0 || mappedAircraftCount > 0}
        <div class="mt-4 p-3 bg-muted/30 rounded-md border border-muted">
          <p class="text-xs text-muted-foreground">{mappingSummary}</p>
        </div>
      {/if}

      <div class="mt-4 flex flex-wrap gap-2">
        <Button
          onclick={handleReprocess}
          disabled={!canReprocess}
          class="flex-1 sm:flex-none"
        >
          Apply Mapping & Re-import
        </Button>
        {#if unknownAirportCodes.length}
          <Button
            href="https://ourairports.com/"
            target="_blank"
            variant="outline"
            class="gap-1"
          >
            Search OurAirports
            <ExternalLink size={14} />
          </Button>
        {/if}
        <Button variant="ghost" onclick={() => onclose?.()} class="ml-auto">
          Close
        </Button>
      </div>
    {:else}
      <div class="mt-4 flex justify-end">
        <Button onclick={() => onclose?.()}>Done</Button>
      </div>
    {/if}
  </Card>
</div>

{#if isAdmin}
  <CreateAirport bind:open={createAirport} withoutTrigger />
  <CreateAirline bind:open={createAirline} withoutTrigger />
  <CreateAircraft bind:open={createAircraft} withoutTrigger />
{/if}
