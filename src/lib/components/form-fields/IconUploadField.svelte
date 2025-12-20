<script lang="ts">
  import { ImageUp, LoaderCircle, Trash2 } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';

  import { Button } from '$lib/components/ui/button';

  let {
    currentIconPath = null,
    airlineId,
    onUpload,
    onRemove,
  }: {
    currentIconPath: string | null;
    airlineId: number | null;
    onUpload?: (path: string) => void;
    onRemove?: () => void;
  } = $props();

  let fileInput: HTMLInputElement;
  let uploading = $state(false);
  let removing = $state(false);
  let cacheKey = $state(Date.now());

  const iconUrl = $derived(
    currentIconPath ? `/api/uploads/${currentIconPath}?v=${cacheKey}` : null,
  );

  async function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file || !airlineId) return;

    uploading = true;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('airlineId', airlineId.toString());

    try {
      const response = await fetch('/api/airline/icon', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (result.success) {
        toast.success('Icon uploaded');
        cacheKey = Date.now();
        onUpload?.(result.path);
      } else {
        toast.error(result.error || 'Failed to upload icon');
      }
    } catch {
      toast.error('Failed to upload icon');
    } finally {
      uploading = false;
      target.value = '';
    }
  }

  async function handleRemove() {
    if (!airlineId) return;

    removing = true;
    try {
      const response = await fetch('/api/airline/icon', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ airlineId }),
      });

      const result = await response.json();
      if (result.success) {
        toast.success('Icon removed');
        onRemove?.();
      } else {
        toast.error(result.error || 'Failed to remove icon');
      }
    } catch {
      toast.error('Failed to remove icon');
    } finally {
      removing = false;
    }
  }

  function triggerUpload() {
    if (!uploading && !removing && airlineId) {
      fileInput.click();
    }
  }
</script>

<input
  bind:this={fileInput}
  type="file"
  accept=".png,.jpg,.jpeg,.svg,.webp"
  onchange={handleFileSelect}
  class="hidden"
  disabled={!airlineId}
/>

<div class="flex items-start gap-4">
  <!-- Preview/Upload Area -->
  <button
    type="button"
    onclick={triggerUpload}
    disabled={!airlineId || uploading || removing}
    class="relative w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 bg-muted/30 hover:bg-muted/50 transition-colors flex items-center justify-center overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed group"
  >
    {#if uploading}
      <div
        class="absolute inset-0 bg-background/80 flex items-center justify-center"
      >
        <LoaderCircle size={24} class="animate-spin text-muted-foreground" />
      </div>
    {:else if iconUrl}
      <img
        src={iconUrl}
        alt="Airline icon"
        class="w-full h-full object-contain p-1"
      />
      <div
        class="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
      >
        <ImageUp size={20} class="text-muted-foreground" />
      </div>
    {:else}
      <ImageUp
        size={24}
        class="text-muted-foreground/50 group-hover:text-muted-foreground transition-colors"
      />
    {/if}
  </button>

  <!-- Actions & Info -->
  <div class="flex flex-col gap-2 pt-1">
    <div class="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading || removing || !airlineId}
        onclick={triggerUpload}
      >
        {#if uploading}
          <LoaderCircle size={14} class="mr-2 animate-spin" />
          Uploading...
        {:else}
          <ImageUp size={14} class="mr-2" />
          {iconUrl ? 'Change' : 'Upload'}
        {/if}
      </Button>
      {#if iconUrl}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={uploading || removing}
          onclick={handleRemove}
          class="text-muted-foreground hover:text-destructive"
        >
          {#if removing}
            <LoaderCircle size={14} class="animate-spin" />
          {:else}
            <Trash2 size={14} />
          {/if}
        </Button>
      {/if}
    </div>
    <p class="text-xs text-muted-foreground">
      PNG, JPG, SVG, or WebP. Max 5MB.
    </p>
  </div>
</div>
