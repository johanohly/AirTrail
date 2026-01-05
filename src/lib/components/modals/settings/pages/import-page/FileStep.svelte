<script lang="ts">
  import { Upload } from '@o7/icon/lucide';
  import { Card } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { cn } from '$lib/utils';

  let {
    files = $bindable(null),
    fileError = null,
    validateFile,
    canNext = false,
    onback,
    onnext,
  }: {
    files?: FileList | null;
    fileError?: string | null;
    validateFile: () => void;
    canNext?: boolean;
    onback?: () => void;
    onnext?: () => void;
  } = $props();
</script>

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
  <Button variant="secondary" onclick={() => onback?.()}>Back</Button>
  <Button onclick={() => onnext?.()} disabled={!canNext}>Next</Button>
</div>
