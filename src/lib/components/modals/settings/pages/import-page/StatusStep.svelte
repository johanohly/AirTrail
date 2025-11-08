<script lang="ts">
  import { Check, CircleAlert, ExternalLink } from '@o7/icon/lucide';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import { Separator } from '$lib/components/ui/separator';
  import type { Airport } from '$lib/db/types';
  import AirportPicker from '$lib/components/form-fields/AirportPicker.svelte';
  import { pluralize } from '$lib/utils';

  let {
    importedCount = 0,
    unknownAirports = [],
    busy = false,
    onreprocess,
    onclose,
  }: {
    importedCount?: number;
    unknownAirports?: string[];
    busy?: boolean;
    onreprocess?: (mapping: Record<string, Airport>) => void;
    onclose?: () => void;
  } = $props();

  let mapping: Record<string, Airport> = $state({});
  const canReprocess = $derived(Object.values(mapping).some(Boolean) && !busy);
  const mappedCount = $derived(Object.keys(mapping).length);

  const setMapping = (code: string, airport: Airport | null) => {
    if (airport) {
      mapping[code] = airport;
    } else {
      delete mapping[code];
    }
  };

  const handleReprocess = () => {
    onreprocess?.(mapping);
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

    {#if unknownAirports.length}
      <Separator class="my-4" />

      <!-- Unknown Airports Section -->
      <div class="flex items-start gap-3">
        <CircleAlert
          class="text-amber-600 dark:text-amber-500 mt-0.5 shrink-0"
          size={20}
        />
        <div class="flex-1">
          <p class="font-medium text-sm">
            {unknownAirports.length} Unknown Airport {pluralize(
              unknownAirports.length,
              'Code',
            )}
          </p>
          <p class="text-sm text-muted-foreground mt-0.5">
            The following airport codes were not found in our database. Match
            them to existing airports to import the remaining flights.
          </p>
        </div>
      </div>

      <ScrollArea class="h-[28dvh] mt-4 pr-2">
        <div class="space-y-3">
          {#each unknownAirports as code (code)}
            <div class="flex items-center gap-3">
              <div
                class="flex items-center justify-center w-20 h-9 bg-muted/50 rounded-md border shrink-0"
              >
                <span class="text-sm font-mono font-medium">{code}</span>
              </div>
              <div class="flex-1">
                <AirportPicker
                  placeholder="Search for airport..."
                  onchange={(airport) => setMapping(code, airport)}
                  disabled={busy}
                  compact
                />
              </div>
            </div>
          {/each}
        </div>
      </ScrollArea>

      {#if mappedCount > 0}
        <div class="mt-4 p-3 bg-muted/30 rounded-md border border-muted">
          <p class="text-xs text-muted-foreground">
            {mappedCount} of {unknownAirports.length}
            {pluralize(unknownAirports.length, 'code')} mapped
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
