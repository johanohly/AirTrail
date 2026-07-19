<script lang="ts">
  import { toast } from 'svelte-sonner';

  import { PageHeader } from '../';

  import PlatformTabs from './PlatformTabs.svelte';

  import { platforms, type ImportFailure } from './';

  import { Info } from '@o7/icon/lucide';

  import { page } from '$app/state';
  import * as Alert from '$lib/components/ui/alert';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import type { Airline, Airport, Aircraft, CreateFlight } from '$lib/db/types';
  import { processFile } from '$lib/import';
  import { flightAddedState } from '$lib/state.svelte';
  import { trpc } from '$lib/trpc';
  import { cn, pluralize } from '$lib/utils';
  import { getErrorText } from '$lib/utils/error';
  import FileStep from './FileStep.svelte';
  import OptionsStep from './OptionsStep.svelte';
  import StatusStep from './StatusStep.svelte';
  import UserMappingStep from './UserMappingStep.svelte';

  let { open = $bindable() }: { open: boolean } = $props();

  let step = $state<1 | 2 | 3 | 4 | 5>(1);

  let files: FileList | null = $state(null);
  let originalFile: File | null = $state(null);
  let fileError: string | null = $state(null);

  let importing = $state(false);
  let importedCount = $state(0);
  let skippedRows = $state(0);
  let importFailures = $state<ImportFailure[]>([]);
  let unknownAirports = $state<Record<string, number[]>>({});
  let unknownAirlines = $state<Record<string, number[]>>({});
  let unknownAircraft = $state<Record<string, number[]>>({});
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
  let userMapping = $state<Record<string, string>>({});
  let appliedAirportMapping = $state<Record<string, Airport>>({});
  let appliedAirlineMapping = $state<Record<string, Airline>>({});
  let appliedAircraftMapping = $state<Record<string, Aircraft>>({});
  let ownerOnly = $state(false);
  let matchAirlineFromFlightNumber = $state(true);
  let dedupeImportedFlights = $state(true);
  let restoreMode = $state(false);

  const importMode = $derived<'personal' | 'restore'>(
    platform.value === 'airtrail' && restoreMode ? 'restore' : 'personal',
  );
  const canRestore = $derived(
    !!page.data.user && page.data.user.role !== 'user',
  );

  const steps = $derived(
    platform.value === 'airtrail'
      ? (['Source', 'File', 'Options', 'Users', 'Status'] as const)
      : (['Source', 'File', 'Options', 'Status'] as const),
  );
  const displayStep = $derived(
    platform.value === 'airtrail' ? step : step === 5 ? 4 : step,
  );

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
  const createMany = trpc.flight.createMany.mutation();

  type FlightImportItem = {
    flight: CreateFlight;
    index: number;
  };

  const getImportErrorMessage = (
    error: unknown,
    fallback = 'Unknown import error',
  ) => {
    return getErrorText(error) || fallback;
  };

  const refreshImportedFlights = async () => {
    await Promise.all([
      trpc.flight.list.utils.invalidate(),
      trpc.flightTrack.list.utils.invalidate(),
    ]);
    flightAddedState.added = true;
  };

  const importBatch = async (
    batch: FlightImportItem[],
  ): Promise<{
    inserted: number;
    attached: number;
    failures: ImportFailure[];
  }> => {
    if (!batch.length) return { inserted: 0, attached: 0, failures: [] };

    try {
      const stats = await $createMany.mutateAsync({
        flights: batch.map(({ flight }) => flight),
        dedupe: dedupeImportedFlights,
        mode: importMode,
      });

      return {
        inserted: stats?.insertedFlights ?? 0,
        attached: stats?.attachedSeats ?? 0,
        failures: [],
      };
    } catch (error) {
      if (batch.length === 1) {
        return {
          inserted: 0,
          attached: 0,
          failures: [
            {
              index: batch[0]!.index,
              message: getImportErrorMessage(error),
            },
          ],
        };
      }

      const middle = Math.floor(batch.length / 2);
      const first = await importBatch(batch.slice(0, middle));
      const second = await importBatch(batch.slice(middle));

      return {
        inserted: first.inserted + second.inserted,
        attached: first.attached + second.attached,
        failures: [...first.failures, ...second.failures],
      };
    }
  };

  const executeImport = async (mapping?: {
    airportMapping?: Record<string, Airport>;
    airlineMapping?: Record<string, Airline>;
    aircraftMapping?: Record<string, Aircraft>;
    userMapping?: Record<string, string>;
  }) => {
    if (!originalFile) return;

    const result = await processFile(originalFile, platform.value, {
      filterOwner: ownerOnly,
      airlineFromFlightNumber: matchAirlineFromFlightNumber,
      importMode,
      airportMapping: mapping?.airportMapping,
      airlineMapping: mapping?.airlineMapping,
      aircraftMapping: mapping?.aircraftMapping,
      userMapping: mapping?.userMapping,
    });

    const { flights } = result;
    if (!flights.length) {
      toast.info('No new flights to import');
      unknownAirports = result.unknownAirports;
      unknownAirlines = result.unknownAirlines;
      unknownAircraft = result.unknownAircraft;
      unknownUsers = result.unknownUsers;
      exportedUsers = result.exportedUsers;
      skippedRows = result.skippedRows ?? 0;
      importFailures = [];
      if (skippedRows > 0) {
        toast.warning(
          `Skipped ${skippedRows} ${pluralize(skippedRows, 'row')} that could not be parsed`,
        );
      }
      return;
    }

    // Exclude flights with unknown airports/airlines/aircraft so they aren't
    // inserted with null references (which would cause duplicates when
    // the user maps the unknowns and re-imports).
    const unknownIndices = new Set([
      ...Object.values(result.unknownAirports).flat(),
      ...Object.values(result.unknownAirlines).flat(),
      ...Object.values(result.unknownAircraft).flat(),
    ]);
    const flightsToImport = flights
      .map((flight, index) => ({ flight, index }))
      .filter(({ index }) => !unknownIndices.has(index));

    // Send flights in batches to avoid exceeding the server body size limit
    const BATCH_SIZE = 50;
    let inserted = 0;
    let attached = 0;
    const failures: ImportFailure[] = [];
    for (let i = 0; i < flightsToImport.length; i += BATCH_SIZE) {
      const batch = flightsToImport.slice(i, i + BATCH_SIZE);
      const result = await importBatch(batch);
      inserted += result.inserted;
      attached += result.attached;
      failures.push(...result.failures);
    }
    if (inserted > 0 || attached > 0) {
      await refreshImportedFlights();
    }

    unknownAirports = result.unknownAirports;
    unknownAirlines = result.unknownAirlines;
    unknownAircraft = result.unknownAircraft;
    unknownUsers = result.unknownUsers;
    exportedUsers = result.exportedUsers;
    skippedRows = result.skippedRows ?? 0;
    importFailures = failures;

    importedCount = mapping ? importedCount + inserted : inserted;
    if (inserted > 0) {
      toast.success(`Imported ${inserted} ${pluralize(inserted, 'flight')}`);
    } else if (failures.length === 0) {
      toast.info('No new flights to import');
    }
    if (skippedRows > 0) {
      toast.warning(
        `Skipped ${skippedRows} ${pluralize(skippedRows, 'row')} that could not be parsed`,
      );
    }
    if (failures.length > 0) {
      toast.error(
        `Skipped ${failures.length} ${pluralize(failures.length, 'flight')} with validation errors`,
      );
    }
  };

  const handleImport = async () => {
    const file = files?.[0];
    if (!file || fileError) return;

    importing = true;
    originalFile = file;

    try {
      const result = await processFile(file, platform.value, {
        filterOwner: ownerOnly,
        airlineFromFlightNumber: matchAirlineFromFlightNumber,
        importMode,
      });

      unknownUsers = result.unknownUsers;
      exportedUsers = result.exportedUsers;

      if (platform.value === 'airtrail') {
        userMapping = Object.fromEntries(
          result.exportedUsers
            .filter((user) => user.mappedUserId)
            .map((user) => [user.id, user.mappedUserId!]),
        );
        files = null;
        importing = false;
        step = 4;
        return;
      }

      if (!result.flights.length) {
        toast.error('No flights found in the file');
        files = null;
        importing = false;
        return;
      }

      await executeImport();
      files = null;
      importing = false;
      step = 4;
    } catch (error) {
      toast.error(getImportErrorMessage(error, 'Failed to import file'));
      console.error(error);
      importing = false;
    }
  };

  const handleUserMappingNext = async (mapping: Record<string, string>) => {
    userMapping = mapping;
    importing = true;
    try {
      await executeImport({ userMapping: mapping });
      step = 5;
    } catch (error) {
      toast.error(getImportErrorMessage(error, 'Failed to import file'));
      console.error(error);
    } finally {
      importing = false;
    }
  };

  const handleReprocess = async (
    airportMapping: Record<string, Airport>,
    airlineMapping: Record<string, Airline>,
    aircraftMapping: Record<string, Aircraft>,
  ): Promise<boolean> => {
    if (!originalFile) return false;
    const nextAirportMapping = {
      ...appliedAirportMapping,
      ...airportMapping,
    };
    const nextAirlineMapping = {
      ...appliedAirlineMapping,
      ...airlineMapping,
    };
    const nextAircraftMapping = {
      ...appliedAircraftMapping,
      ...aircraftMapping,
    };

    importing = true;
    try {
      await executeImport({
        airportMapping: nextAirportMapping,
        airlineMapping: nextAirlineMapping,
        aircraftMapping: nextAircraftMapping,
        userMapping,
      });
      appliedAirportMapping = nextAirportMapping;
      appliedAirlineMapping = nextAirlineMapping;
      appliedAircraftMapping = nextAircraftMapping;
      return true;
    } catch (error) {
      toast.error(getImportErrorMessage(error, 'Failed to reprocess file'));
      console.error(error);
      return false;
    } finally {
      importing = false;
    }
  };

  const closeAndReset = () => {
    unknownAirports = {};
    unknownAirlines = {};
    unknownAircraft = {};
    unknownUsers = {};
    exportedUsers = [];
    userMapping = {};
    appliedAirportMapping = {};
    appliedAirlineMapping = {};
    appliedAircraftMapping = {};
    importedCount = 0;
    skippedRows = 0;
    importFailures = [];
    files = null;
    originalFile = null;
    fileError = null;
    importing = false;
    ownerOnly = false;
    matchAirlineFromFlightNumber = true;
    dedupeImportedFlights = true;
    restoreMode = false;
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
            'text-primary': displayStep === i + 1,
          })}
        >
          <div
            class={cn(
              'h-6 w-6 rounded-full border flex items-center justify-center text-[0.8rem]',
              {
                'bg-primary text-primary-foreground border-primary':
                  displayStep === i + 1,
                'text-muted-foreground border-muted': displayStep !== i + 1,
              },
            )}
            aria-current={displayStep === i + 1 ? 'step' : undefined}
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
    {#if platform.value === 'airtrail'}
      <Alert.Root variant="info" class="mt-2">
        <Info />
        <Alert.Description>
          Custom field values are included in the export for reference, but are
          not restored during import.
          {#if !canRestore}
            Only flights belonging to the exported account you map to yourself
            will be imported. Other passengers will be added as guests.
          {/if}
        </Alert.Description>
      </Alert.Root>
    {/if}
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
      showRestoreMode={platform.value === 'airtrail' && canRestore}
      bind:ownerOnly
      bind:matchAirlineFromFlightNumber
      bind:dedupeImportedFlights
      bind:restoreMode
      {importing}
      {canImport}
      onback={() => (step = 2)}
      onimport={handleImport}
    />
  {:else if step === 4 && platform.value === 'airtrail'}
    <UserMappingStep
      {exportedUsers}
      {userMapping}
      {restoreMode}
      busy={importing}
      onback={() => (step = 3)}
      onnext={handleUserMappingNext}
    />
  {:else}
    <StatusStep
      {importedCount}
      {skippedRows}
      {importFailures}
      {unknownAirports}
      {unknownAirlines}
      {unknownAircraft}
      busy={importing}
      onreprocess={handleReprocess}
      onclose={closeAndReset}
    />
  {/if}
</PageHeader>
