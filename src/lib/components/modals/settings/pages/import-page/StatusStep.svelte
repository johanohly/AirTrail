<script lang="ts">
  import { Check, CircleAlert, ExternalLink } from '@o7/icon/lucide';

  import UnknownMappingSection from './UnknownMappingSection.svelte';

  import type { ImportFailure } from './';

  import { page } from '$app/state';
  import AircraftPicker from '$lib/components/form-fields/AircraftPicker.svelte';
  import AirlinePicker from '$lib/components/form-fields/AirlinePicker.svelte';
  import AirportPicker from '$lib/components/form-fields/AirportPicker.svelte';
  import CreateAircraft from '$lib/components/modals/settings/pages/data-page/aircraft/CreateAircraft.svelte';
  import CreateAirline from '$lib/components/modals/settings/pages/data-page/airline/CreateAirline.svelte';
  import CreateAirport from '$lib/components/modals/settings/pages/data-page/airport/CreateAirport.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import { Separator } from '$lib/components/ui/separator';
  import type { Airline, Airport, Aircraft } from '$lib/db/types';
  import {
    createEmptyImportMappings,
    createEmptyImportUnknowns,
    type ImportMappings,
    type ImportUnknowns,
  } from '$lib/import/model';
  import { pluralize } from '$lib/utils';

  let {
    importedCount = 0,
    skippedRows = 0,
    importFailures = [],
    unknowns = createEmptyImportUnknowns(),
    busy = false,
    onreprocess,
    onclose,
  }: {
    importedCount?: number;
    skippedRows?: number;
    importFailures?: ImportFailure[];
    unknowns?: ImportUnknowns;
    busy?: boolean;
    onreprocess?: (mappings: ImportMappings) => Promise<boolean>;
    onclose?: () => void;
  } = $props();

  const unknownAirportCodes = $derived(Object.keys(unknowns.airports));
  const unknownAirlineCodes = $derived(Object.keys(unknowns.airlines));
  const unknownAircraftCodes = $derived(Object.keys(unknowns.aircraft));

  let mappings = $state<ImportMappings>(createEmptyImportMappings());

  const mappingSections = $derived([
    {
      label: 'airport',
      unknownCount: unknownAirportCodes.length,
      mappedCount: Object.keys(mappings.airports).length,
    },
    {
      label: 'airline',
      unknownCount: unknownAirlineCodes.length,
      mappedCount: Object.keys(mappings.airlines).length,
    },
    {
      label: 'aircraft',
      unknownCount: unknownAircraftCodes.length,
      mappedCount: Object.keys(mappings.aircraft).length,
    },
  ]);
  const mappedCount = $derived(
    mappingSections.reduce((count, section) => count + section.mappedCount, 0),
  );
  const unmatchedCount = $derived(
    mappingSections.reduce((count, section) => count + section.unknownCount, 0),
  );
  const canReprocess = $derived(mappedCount > 0 && !busy);
  const mappingSummary = $derived.by(() => {
    return mappingSections
      .filter((section) => section.mappedCount > 0)
      .map(
        (section) =>
          `${section.mappedCount} of ${section.unknownCount} ${pluralize(
            section.unknownCount,
            section.label,
          )} mapped`,
      )
      .join(' • ');
  });

  const isAdmin = $derived(page.data.user?.role !== 'user');

  let createAirport = $state(false);
  let createAirline = $state(false);
  let createAircraft = $state(false);

  const setAirportMapping = (code: string, airport: Airport | null) => {
    if (airport) {
      mappings.airports[code] = airport;
    } else {
      delete mappings.airports[code];
    }
  };

  const setAirlineMapping = (code: string, airline: Airline | null) => {
    if (airline) {
      mappings.airlines[code] = airline;
    } else {
      delete mappings.airlines[code];
    }
  };

  const setAircraftMapping = (code: string, aircraft: Aircraft | null) => {
    if (aircraft) {
      mappings.aircraft[code] = aircraft;
    } else {
      delete mappings.aircraft[code];
    }
  };

  const handleReprocess = async () => {
    const succeeded = await onreprocess?.(mappings);
    if (!succeeded) return;

    mappings = createEmptyImportMappings();
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
          <UnknownMappingSection title="Airports" codes={unknownAirportCodes}>
            {#snippet children(code)}
              <AirportPicker
                placeholder="Search for airport..."
                onchange={(airport) => setAirportMapping(code, airport)}
                onCreateNew={isAdmin ? () => (createAirport = true) : undefined}
                disabled={busy}
                compact
              />
            {/snippet}
          </UnknownMappingSection>

          <UnknownMappingSection
            title="Airlines"
            codes={unknownAirlineCodes}
            separated={unknownAirportCodes.length > 0}
          >
            {#snippet children(code)}
              <AirlinePicker
                placeholder="Search for airline..."
                onchange={(airline) => setAirlineMapping(code, airline)}
                onCreateNew={isAdmin ? () => (createAirline = true) : undefined}
                disabled={busy}
                compact
              />
            {/snippet}
          </UnknownMappingSection>

          <UnknownMappingSection
            title="Aircraft"
            codes={unknownAircraftCodes}
            separated={unknownAirportCodes.length > 0 ||
              unknownAirlineCodes.length > 0}
          >
            {#snippet children(code)}
              <AircraftPicker
                placeholder="Search for aircraft..."
                onchange={(aircraft) => setAircraftMapping(code, aircraft)}
                onCreateNew={isAdmin
                  ? () => (createAircraft = true)
                  : undefined}
                disabled={busy}
                compact
              />
            {/snippet}
          </UnknownMappingSection>
        </div>
      </ScrollArea>

      {#if mappedCount > 0}
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
