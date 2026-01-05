<script lang="ts">
  import { Check, CircleAlert, ExternalLink } from '@o7/icon/lucide';

  import AirlinePicker from '$lib/components/form-fields/AirlinePicker.svelte';
  import AirportPicker from '$lib/components/form-fields/AirportPicker.svelte';
  import CreateAirline from '$lib/components/modals/settings/pages/data-page/airline/CreateAirline.svelte';
  import CreateAirport from '$lib/components/modals/settings/pages/data-page/airport/CreateAirport.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import { Separator } from '$lib/components/ui/separator';
  import type { Airline, Airport } from '$lib/db/types';
  import { pluralize } from '$lib/utils';

  let {
    importedCount = 0,
    unknownAirports = {},
    unknownAirlines = {},
    busy = false,
    onreprocess,
    onclose,
  }: {
    importedCount?: number;
    unknownAirports?: Record<string, string[]>;
    unknownAirlines?: Record<string, string[]>;
    busy?: boolean;
    onreprocess?: (
      airportMapping: Record<string, Airport>,
      airlineMapping: Record<string, Airline>,
    ) => void;
    onclose?: () => void;
  } = $props();

  const unknownAirportCodes = $derived(Object.keys(unknownAirports));
  const unknownAirlineCodes = $derived(Object.keys(unknownAirlines));

  let airportMapping: Record<string, Airport> = $state({});
  let airlineMapping: Record<string, Airline> = $state({});
  const canReprocess = $derived(
    (Object.values(airportMapping).some(Boolean) ||
      Object.values(airlineMapping).some(Boolean)) &&
      !busy,
  );
  const mappedAirportCount = $derived(Object.keys(airportMapping).length);
  const mappedAirlineCount = $derived(Object.keys(airlineMapping).length);

  let createAirport = $state(false);
  let createAirline = $state(false);

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

  const handleReprocess = () => {
    onreprocess?.(airportMapping, airlineMapping);
  };
</script>

<div class="space-y-4">
  <h3 class="text-sm font-medium">Import Status</h3>

  <Card class="p-4">
    <!-- Success Section -->
    <div class="flex items-start gap-3">
      <Check
        class="text-green-600 dark:text-green-500 mt-0.5 shrink-0"
        size={20}
      />
      <div class="flex-1">
        <p class="font-medium text-sm">Import Complete</p>
        <p class="text-sm text-muted-foreground mt-0.5">
          Successfully imported {importedCount}
          {pluralize(importedCount, 'flight')}
        </p>
      </div>
    </div>

    {#if unknownAirportCodes.length || unknownAirlineCodes.length}
      <Separator class="my-4" />

      <!-- Unknown Codes Section -->
      <div class="flex items-start gap-3">
        <CircleAlert
          class="text-amber-600 dark:text-amber-500 mt-0.5 shrink-0"
          size={20}
        />
        <div class="flex-1">
          <p class="font-medium text-sm">
            {unknownAirportCodes.length + unknownAirlineCodes.length} Unknown {pluralize(
              unknownAirportCodes.length + unknownAirlineCodes.length,
              'Code',
            )}
          </p>
          <p class="text-sm text-muted-foreground mt-0.5">
            The following codes were not found in our database. Match them to
            existing entries or create new ones.
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
                <div class="flex items-center gap-3">
                  <div
                    class="flex items-center justify-center w-20 h-9 bg-muted/50 rounded-md border shrink-0"
                  >
                    <span class="text-sm font-mono font-medium">{code}</span>
                  </div>
                  <div class="flex-1">
                    <AirportPicker
                      placeholder="Search for airport..."
                      onchange={(airport) => setAirportMapping(code, airport)}
                      onCreateNew={() => (createAirport = true)}
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
                <div class="flex items-center gap-3">
                  <div
                    class="flex items-center justify-center w-20 h-9 bg-muted/50 rounded-md border shrink-0"
                  >
                    <span class="text-sm font-mono font-medium">{code}</span>
                  </div>
                  <div class="flex-1">
                    <AirlinePicker
                      placeholder="Search for airline..."
                      onchange={(airline) => setAirlineMapping(code, airline)}
                      onCreateNew={() => (createAirline = true)}
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

      {#if mappedAirportCount > 0 || mappedAirlineCount > 0}
        <div class="mt-4 p-3 bg-muted/30 rounded-md border border-muted">
          <p class="text-xs text-muted-foreground">
            {#if mappedAirportCount > 0}
              {mappedAirportCount} of {unknownAirportCodes.length}
              {pluralize(unknownAirportCodes.length, 'airport')} mapped
            {/if}
            {#if mappedAirportCount > 0 && mappedAirlineCount > 0}
              <span class="mx-1">•</span>
            {/if}
            {#if mappedAirlineCount > 0}
              {mappedAirlineCount} of {unknownAirlineCodes.length}
              {pluralize(unknownAirlineCodes.length, 'airline')} mapped
            {/if}
          </p>
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
        <Button
          href="https://ourairports.com/"
          target="_blank"
          variant="outline"
          class="gap-1"
        >
          Search OurAirports
          <ExternalLink size={14} />
        </Button>
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

<CreateAirport bind:open={createAirport} withoutTrigger />
<CreateAirline bind:open={createAirline} withoutTrigger />
