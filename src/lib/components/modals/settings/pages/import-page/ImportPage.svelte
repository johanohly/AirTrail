<script lang="ts">
  import { LoaderCircle, Upload } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';

  import { PageHeader } from '../';

  import PlatformTabs from './PlatformTabs.svelte';

  import { platforms } from './';

  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Label } from '$lib/components/ui/label';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import { processFile } from '$lib/import';
  import { trpc } from '$lib/trpc';
  import { cn, pluralize } from '$lib/utils';

  let { open = $bindable() }: { open: boolean } = $props();

  let step = $state<1 | 2 | 3 | 4>(1);

  let files: FileList | null = $state(null);
  let fileError: string | null = $state(null);

  let importing = $state(false);
  let importedCount = $state(0);
  let unknownAirports = $state<string[]>([]);

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
    importedCount = stats?.insertedFlights ?? 0;
    if (importedCount > 0) {
      toast.success(
        `Imported ${importedCount} ${pluralize(importedCount, 'flight')}`,
      );
    } else {
      toast.info('No new flights to import');
    }
    files = null;
    importing = false;
    step = 4; // Show status screen
  };

  const closeAndReset = () => {
    unknownAirports = [];
    importedCount = 0;
    files = null;
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
    <!-- Step 2: Choose file -->
    <div class="space-y-2">
      <h3 class="text-sm font-medium">Upload file</h3>
      <label for="file" class="block">
        <Card
          class={cn(
            'cursor-pointer py-12 border-2 border-dashed flex flex-col items-center hover:bg-card-hover dark:hover:bg-dark-2',
            { 'border-destructive': fileError },
          )}
        >
          <Upload />
          {#if fileError}
            {fileError}
          {:else}
            {files?.[0]?.name ?? 'Upload file'}
          {/if}
        </Card>
      </label>
      <p class="text-xs text-muted-foreground">
        Supported: CSV, TXT, JSON, ICS. Max 5MB.
      </p>
    </div>
    <input
      onchange={validateFile}
      id="file"
      name="file"
      type="file"
      accept=".csv,.txt,.json,.ics"
      bind:files
      class="hidden"
    />
    <div class="mt-4 flex justify-between">
      <Button variant="secondary" onclick={() => (step = 1)}>Back</Button>
      <Button onclick={() => (step = 3)} disabled={!canImport}>Next</Button>
    </div>
  {:else if step === 3}
    <!-- Step 3: Options (if any) -->
    <div class="space-y-2">
      <h3 class="text-sm font-medium">Options</h3>
      <Card class="p-3 space-y-2">
        {#if platform.options.airlineFromFlightNumber}
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
        {#if platform.options.filterOwner}
          <div class="flex items-center gap-2">
            <Checkbox
              id="owner-only"
              bind:checked={ownerOnly}
              aria-labelledby="owner-only-label"
            />
            <Label id="owner-only-label" for="owner-only">
              Only import your flights
            </Label>
          </div>
        {/if}
        <div class="flex items-center gap-2">
          <Checkbox
            id="dedupe-imported-flights"
            bind:checked={dedupeImportedFlights}
            aria-labelledby="dedupe-imported-flights-label"
          />
          <Label
            id="dedupe-imported-flights-label"
            for="dedupe-imported-flights"
          >
            Deduplicate imported flights
          </Label>
        </div>
      </Card>
      <div class="mt-4 flex justify-between">
        <Button variant="secondary" onclick={() => (step = 2)}>Back</Button>
        <Button onclick={handleImport} disabled={!canImport || importing}>
          {#if importing}
            <LoaderCircle class="animate-spin mr-1" size={16} />
          {/if}
          Import
        </Button>
      </div>
    </div>
  {:else}
    <!-- Step 4: Status/result -->
    <div class="space-y-2">
      <h3 class="text-sm font-medium">Status</h3>
      <Card class="p-3">
        <p class="text-sm">Imported {importedCount} flights.</p>

        {#if unknownAirports.length}
          <h4 class="mt-4 text-md font-semibold">Unknown airports</h4>
          <p class="text-muted-foreground">
            The following airports are not in the database and flights with
            these airports have therefore not been imported.
          </p>
          <p class="text-muted-foreground">
            Chances are the airport codes have been officially changed, but that
            the change hasn't reflected in your export file. The easiest
            solution is to investigate the codes, and manually change the
            occurrences in the file before trying to import again.
          </p>
          <p class="text-muted-foreground">
            If the airports are truly missing, please report them directly to
            our source, <a href="https://ourairports.com/">OurAirports</a>, or
            add them as custom airports.
          </p>
          <ScrollArea class="h-[30dvh]">
            <ul class="mt-4 ml-4 list-disc">
              {#each unknownAirports as airport (airport)}
                <li>{airport}</li>
              {/each}
            </ul>
          </ScrollArea>
          <div class="mt-4 flex gap-2">
            <Button href="https://ourairports.com/" target="_blank"
              >OurAirports</Button
            >
            <Button variant="secondary" onclick={closeAndReset}>Close</Button>
          </div>
        {:else}
          <div class="mt-4 flex justify-end">
            <Button onclick={closeAndReset}>Close</Button>
          </div>
        {/if}
      </Card>
    </div>
  {/if}
</PageHeader>
