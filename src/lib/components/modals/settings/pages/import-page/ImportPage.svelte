<script lang="ts">
  import { toast } from 'svelte-sonner';

  import { PageHeader } from '../';

  import PlatformTabs from './PlatformTabs.svelte';

  import { platforms } from './';

  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { processFile } from '$lib/import';
  import { trpc } from '$lib/trpc';
  import { cn, pluralize } from '$lib/utils';
  import FileStep from './FileStep.svelte';
  import OptionsStep from './OptionsStep.svelte';
  import StatusStep from './StatusStep.svelte';
  import type { Airline, Airport } from '$lib/db/types';

  let { open = $bindable() }: { open: boolean } = $props();

  let step = $state<1 | 2 | 3 | 4>(1);

  let files: FileList | null = $state(null);
  let originalFile: File | null = $state(null);
  let fileError: string | null = $state(null);

  let importing = $state(false);
  let importedCount = $state(0);
  let unknownAirports = $state<Record<string, number[]>>({});
  let unknownAirlines = $state<Record<string, number[]>>({});
  let unknownUsers = $state<Record<string, number[]>>({});
  let exportedUsers = $state<
    {
      id: string;
      username: string;
      displayName: string;
      mappedUserId: string | null;
    }[]
  >([]);

  let platform = $state<(typeof platforms)[0]>(platforms[0]);
  let ownerOnly = $state(false);
  let matchAirlineFromFlightNumber = $state(true);
  let dedupeImportedFlights = $state(true);

  const steps = ['Source', 'File', 'Options', 'Status'] as const;

  const validateFile = () => {
    const file = files?.[0];
    if (!file) return;

    if (
      !file.name.endsWith('.csv') &&
      !file.name.endsWith('.txt') &&
      !file.name.endsWith('.json') &&
      !file.name.endsWith('.ics')
    ) {
      fileError = 'File type not supported';
    } else if (file.size > 5 * 1024 * 1024) {
      fileError = 'File must be less than 5MB';
    } else {
      fileError = null;
    }
  };

  const canImport = $derived(!!files?.[0] && !fileError);
  const invalidator = {
    onSuccess: () => {
      trpc.flight.list.utils.invalidate();
    },
  };
  const createMany = trpc.flight.createMany.mutation(invalidator);

  const handleImport = async () => {
    const file = files?.[0];
    if (!file || fileError) return;

    importing = true;
    originalFile = file; // keep for reprocessing with mappings
    let result: Awaited<ReturnType<typeof processFile>>;
    try {
      result = await processFile(file, platform.value, {
        filterOwner: ownerOnly,
        airlineFromFlightNumber: matchAirlineFromFlightNumber,
      });
    } catch (error) {
      toast.error('Failed to import file');
      console.error(error);
      importing = false;
      return;
    }

    const { flights } = result;

    if (!flights.length) {
      toast.error('No flights found in the file');
      files = null;
      importing = false;
      return;
    }

    const stats = await $createMany.mutateAsync({
      flights,
      dedupe: dedupeImportedFlights,
    });

    unknownAirports = result.unknownAirports;
    unknownAirlines = result.unknownAirlines;
    unknownUsers = result.unknownUsers;
    exportedUsers = result.exportedUsers;
    importedCount = stats?.insertedFlights ?? 0;
    if (importedCount > 0) {
      toast.success(
        `Imported ${importedCount} ${pluralize(importedCount, 'flight')}`,
      );
    } else {
      toast.info('No new flights to import');
    }
    files = null; // clear picker, retain originalFile
    importing = false;
    step = 4; // Show status screen
  };

  const handleReprocess = async (
    airportMapping: Record<string, Airport>,
    airlineMapping: Record<string, Airline>,
    userMapping: Record<string, string>,
  ) => {
    if (!originalFile) return;
    importing = true;
    try {
      const result = await processFile(originalFile, platform.value, {
        filterOwner: ownerOnly,
        airlineFromFlightNumber: matchAirlineFromFlightNumber,
        airportMapping,
        airlineMapping,
        userMapping,
      });

      const { flights } = result;
      if (flights.length) {
        const stats = await $createMany.mutateAsync({
          flights,
          dedupe: dedupeImportedFlights,
        });
        const added = stats?.insertedFlights ?? 0;
        importedCount += added;
        if (added > 0) {
          toast.success(`Imported ${added} ${pluralize(added, 'flight')}`);
        } else {
          toast.info('No new flights to import with this mapping');
        }
      } else {
        toast.info('No additional flights found with this mapping');
      }

      unknownAirports = result.unknownAirports;
      unknownAirlines = result.unknownAirlines;
      unknownUsers = result.unknownUsers;
      exportedUsers = result.exportedUsers;
    } catch (error) {
      toast.error('Failed to reprocess file');
      console.error(error);
    } finally {
      importing = false;
    }
  };

  const closeAndReset = () => {
    unknownAirports = {};
    unknownAirlines = {};
    unknownUsers = {};
    exportedUsers = [];
    importedCount = 0;
    files = null;
    originalFile = null;
    fileError = null;
    importing = false;
    ownerOnly = false;
    matchAirlineFromFlightNumber = true;
    dedupeImportedFlights = true;
    platform = platforms[0];
    step = 1;
    open = false;
  };
</script>

<PageHeader title="Import">
  {#snippet subtitleHtml()}
    <p class="text-muted-foreground text-sm">
      Import your data from another platform. Learn more about the platforms <a
        href="https://airtrail.johan.ohly.dk/docs/features/import"
        target="_blank"
        class="text-blue-500 underline">in the documentation</a
      >.
    </p>
  {/snippet}

  <nav class="-mt-2 mb-2" aria-label="Import steps">
    <ol class="flex items-center gap-2 text-sm">
      {#each steps as s, i (s)}
        <li
          class={cn('flex items-center gap-2', {
            'text-primary': step === i + 1,
          })}
        >
          <div
            class={cn(
              'h-6 w-6 rounded-full border flex items-center justify-center text-[0.8rem]',
              {
                'bg-primary text-primary-foreground border-primary':
                  step === i + 1,
                'text-muted-foreground border-muted': step !== i + 1,
              },
            )}
            aria-current={step === i + 1 ? 'step' : undefined}
          >
            {i + 1}
          </div>
          <span class="hidden sm:inline text-muted-foreground">{s}</span>
          {#if i < steps.length - 1}
            <span class="text-muted-foreground">/</span>
          {/if}
        </li>
      {/each}
    </ol>
  </nav>

  {#if step === 1}
    <!-- Step 1: Choose source/platform -->
    <div class="space-y-2">
      <h3 class="text-sm font-medium">Choose a source</h3>
      <Card class="p-3">
        <PlatformTabs bind:platform />
      </Card>
    </div>
    <div class="mt-4 flex justify-end">
      <Button onclick={() => (step = 2)}>Next</Button>
    </div>
  {:else if step === 2}
    <FileStep
      bind:files
      {fileError}
      {validateFile}
      canNext={canImport}
      onback={() => (step = 1)}
      onnext={() => (step = 3)}
    />
  {:else if step === 3}
    <OptionsStep
      showAirlineFromFlightNumber={platform.options.airlineFromFlightNumber}
      showFilterOwner={platform.options.filterOwner}
      bind:ownerOnly
      bind:matchAirlineFromFlightNumber
      bind:dedupeImportedFlights
      {importing}
      {canImport}
      onback={() => (step = 2)}
      onimport={handleImport}
    />
  {:else}
    <StatusStep
      {importedCount}
      {unknownAirports}
      {unknownAirlines}
      {unknownUsers}
      {exportedUsers}
      busy={importing}
      onreprocess={handleReprocess}
      onclose={closeAndReset}
    />
  {/if}
</PageHeader>
