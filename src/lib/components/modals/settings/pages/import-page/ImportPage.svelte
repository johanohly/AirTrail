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
  import { cn } from '$lib/utils';

  let { open = $bindable() }: { open: boolean } = $props();

  // Wizard state
  let step = $state<1 | 2 | 3 | 4>(1);

  // File state
  let files: FileList | null = $state(null);
  let fileError: string | null = $state(null);

  // Import state
  let importing = $state(false);
  let importedCount = $state(0);
  let unknownAirports = $state<string[]>([]);

  // Platform/options state
  let platform = $state<(typeof platforms)[0]>(platforms[0]);
  let ownerOnly = $state(false);
  let matchAirlineFromFlightNumber = $state(true);
  let dedupeImportedFlights = $state(true);

  const validateFile = () => {
    const file = files?.[0];
    if (!file) return;

    if (
      !file.name.endsWith('.csv') &&
      !file.name.endsWith('.txt') &&
      !file.name.endsWith('.json')
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

    const stats = await $createMany.mutateAsync({ flights, dedupe: dedupeImportedFlights });

    unknownAirports = result.unknownAirports;
    importedCount = stats?.insertedFlights ?? 0;
    if (importedCount > 0) {
      toast.success(`Imported ${importedCount} flights`);
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

  {#if step === 1}
    <!-- Step 1: Choose source/platform -->
    <PlatformTabs bind:platform />
    <div class="mt-4 flex justify-end">
      <Button onclick={() => (step = 2)}>Next</Button>
    </div>
  {:else if step === 2}
    <!-- Step 2: Choose file -->
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
    <input
      onchange={validateFile}
      id="file"
      name="file"
      type="file"
      accept=".csv,.txt,.json"
      bind:files
      class="hidden"
    />
    <div class="mt-4 flex justify-between">
      <Button variant="secondary" onclick={() => (step = 1)}>Back</Button>
      <Button onclick={() => (step = 3)} disabled={!canImport}>Next</Button>
    </div>
  {:else if step === 3}
    <!-- Step 3: Options (if any) -->
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
    <div class="flex items-center gap-2 mt-2">
      <Checkbox
        id="dedupe-imported-flights"
        bind:checked={dedupeImportedFlights}
        aria-labelledby="dedupe-imported-flights-label"
      />
      <Label id="dedupe-imported-flights-label" for="dedupe-imported-flights">
        Deduplicate imported flights
      </Label>
    </div>
    <div class="mt-4 flex justify-between">
      <Button variant="secondary" onclick={() => (step = 2)}>Back</Button>
      <Button onclick={handleImport} disabled={!canImport || importing}>
        {#if importing}
          <LoaderCircle class="animate-spin mr-1" size={16} />
        {/if}
        Import
      </Button>
    </div>
  {:else}
    <!-- Step 4: Status/result -->
    <h3 class="text-lg font-semibold">Import status</h3>
    <p class="text-muted-foreground">Imported {importedCount} flights.</p>

    {#if unknownAirports.length}
      <h4 class="mt-4 text-md font-semibold">Unknown airports</h4>
      <p class="text-muted-foreground">
        The following airports are not in the database and flights with these
        airports have therefore not been imported.
      </p>
      <p class="text-muted-foreground">
        Chances are the airport codes have been officially changed, but that the
        change hasn't reflected in your export file. The easiest solution is to
        investigate the codes, and manually change the occurrences in the file
        before trying to import again.
      </p>
      <p class="text-muted-foreground">
        If the airports are truly missing, please report them directly to our
        source, <a href="https://ourairports.com/">OurAirports</a>, or add them as
        custom airports.
      </p>
      <ScrollArea class="h-[30dvh]">
        <ul class="mt-4 ml-4 list-disc">
          {#each unknownAirports as airport (airport)}
            <li>{airport}</li>
          {/each}
        </ul>
      </ScrollArea>
      <div class="mt-4 flex gap-2">
        <Button href="https://ourairports.com/" target="_blank">OurAirports</Button>
        <Button variant="secondary" onclick={closeAndReset}>Close</Button>
      </div>
    {:else}
      <div class="mt-4 flex justify-end">
        <Button onclick={closeAndReset}>Close</Button>
      </div>
    {/if}
  {/if}
</PageHeader>
