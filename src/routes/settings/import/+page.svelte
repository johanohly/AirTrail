<script lang="ts">
  import { Card } from "$lib/components/ui/card";
  import { Upload } from "@o7/icon/lucide";
  import { cn } from "$lib/utils";
  import { processFile } from "$lib/import";
  import { Button } from "$lib/components/ui/button";
  import { Separator } from "$lib/components/ui/separator";
  import { toast } from "svelte-sonner";
  import { trpc } from "$lib/trpc";

  let files: FileList | undefined;
  let fileError: string | null = null;

  const validateFile = () => {
    const file = files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv") && !file.name.endsWith(".txt")) {
      fileError = "File must be a CSV or TXT file";
    } else if (file.size > 5 * 1024 * 1024) {
      fileError = "File must be less than 5MB";
    } else {
      fileError = null;
    }
  };

  $: canImport = files?.[0] && !fileError;
  const createMany = trpc.flight.createMany.mutation();

  const handleImport = async () => {
    const file = files?.[0];
    if (!file || fileError) return;

    const flights = await processFile(file);
    if (!flights.length) {
      toast.error("No flights found in the file");
      files = undefined;
      return;
    }

    await $createMany.mutateAsync(flights);

    toast.success(`Imported ${flights.length} flights`);
    files = undefined;
  };
</script>

<div class="space-y-6">
  <div>
    <h3 class="text-lg font-medium">Import</h3>
    <p class="text-muted-foreground text-sm">
      Supported platforms: FlightRadar24
    </p>
  </div>
  <Separator />
  <label class="mt-6" for="file">
    <Card
      class={cn("cursor-pointer py-12 border-2 border-dashed flex flex-col items-center hover:bg-card-hover", {"border-destructive": fileError})}>
      <Upload />
      {#if fileError}
        {fileError}
      {:else}
        {files?.[0]?.name ?? "Upload file"}
      {/if}
    </Card>
  </label>
  <input onchange={validateFile} id="file" name="file" type="file" accept=".csv,.txt" bind:files
         class="hidden" />
  <Button on:click={handleImport} disabled={!canImport}>Import</Button>
</div>
