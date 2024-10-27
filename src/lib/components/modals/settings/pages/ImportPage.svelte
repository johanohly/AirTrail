<script lang="ts">
  import { PageHeader } from '.';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { cn } from '$lib/utils';
  import { Upload } from '@o7/icon/lucide';
  import { trpc } from '$lib/trpc';
  import { processFile } from '$lib/import';
  import { toast } from 'svelte-sonner';

  let files: FileList | null = $state(null);
  let fileError: string | null = $state(null);

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

    const flights = await processFile(file);
    if (!flights.length) {
      toast.error('No flights found in the file');
      files = null;
      return;
    }

    await $createMany.mutateAsync(flights);

    toast.success(`Imported ${flights.length} flights`);
    files = null;
  };
</script>

<PageHeader
  title="Import"
  subtitle="Supported platforms: FlightRadar24, App in the Air, JetLog and AirTrail backups"
>
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
  <Button onclick={handleImport} disabled={!canImport}>Import</Button>
</PageHeader>
