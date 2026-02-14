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
  import UserMappingStep from './UserMappingStep.svelte';
  import type { Airline, Airport } from '$lib/db/types';

  let { open = $bindable() }: { open: boolean } = $props();

  let step = $state<1 | 2 | 3 | 4 | 5>(1);

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
  let userMapping = $state<Record<string, string>>({});
  let ownerOnly = $state(false);
  let matchAirlineFromFlightNumber = $state(true);
  let dedupeImportedFlights = $state(true);

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
  const invalidator = {
    onSuccess: () => {
      trpc.flight.list.utils.invalidate();
    },
  };
  const createMany = trpc.flight.createMany.mutation(invalidator);

  const executeImport = async (mapping?: {
    airportMapping?: Record<string, Airport>;
    airlineMapping?: Record<string, Airline>;
    userMapping?: Record<string, string>;
  }) => {
    if (!originalFile) return;

    const result = await processFile(originalFile, platform.value, {
      filterOwner: ownerOnly,
      airlineFromFlightNumber: matchAirlineFromFlightNumber,
      airportMapping: mapping?.airportMapping,
      airlineMapping: mapping?.airlineMapping,
      userMapping: mapping?.userMapping,
    });

    const { flights } = result;
    if (!flights.length) {
      toast.info('No new flights to import');
      unknownAirports = result.unknownAirports;
      unknownAirlines = result.unknownAirlines;
      unknownUsers = result.unknownUsers;
      exportedUsers = result.exportedUsers;
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

    const inserted = stats?.insertedFlights ?? 0;
    importedCount = mapping ? importedCount + inserted : inserted;
    if (inserted > 0) {
      toast.success(`Imported ${inserted} ${pluralize(inserted, 'flight')}`);
    } else {
      toast.info('No new flights to import');
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
      });

      if (!result.flights.length) {
        toast.error('No flights found in the file');
        files = null;
        importing = false;
        return;
      }

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

      await executeImport();
      files = null;
      importing = false;
      step = 4;
    } catch (error) {
      toast.error('Failed to import file');
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
      toast.error('Failed to import file');
      console.error(error);
    } finally {
      importing = false;
    }
  };

  const handleReprocess = async (
    airportMapping: Record<string, Airport>,
    airlineMapping: Record<string, Airline>,
  ) => {
    if (!originalFile) return;
    importing = true;
    try {
      await executeImport({ airportMapping, airlineMapping, userMapping });
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
    userMapping = {};
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
  {:else if step === 4 && platform.value === 'airtrail'}
    <UserMappingStep
      {exportedUsers}
      {userMapping}
      busy={importing}
      onback={() => (step = 3)}
      onnext={handleUserMappingNext}
    />
  {:else}
    <StatusStep
      {importedCount}
      {unknownAirports}
      {unknownAirlines}
      busy={importing}
      onreprocess={handleReprocess}
      onclose={closeAndReset}
    />
  {/if}
</PageHeader>
