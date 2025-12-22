<script lang="ts">
  import { ImageUp, LoaderCircle, Trash2 } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';

  import { Button } from '$lib/components/ui/button';

  const ALLOWED_TYPES = [
    'image/png',
    'image/jpeg',
    'image/svg+xml',
    'image/webp',
  ];
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  let {
    currentIconPath = null,
    airlineId,
    onUpload,
    onRemove,
    pendingMode = false,
    pendingFile = $bindable<File | null>(null),
  }: {
    currentIconPath: string | null;
    airlineId: number | null;
    onUpload?: (path: string) => void;
    onRemove?: () => void;
    pendingMode?: boolean;
    pendingFile?: File | null;
  } = $props();

  let fileInput: HTMLInputElement;
  let uploading = $state(false);
  let removing = $state(false);
  let cacheKey = $state(Date.now());
  let pendingPreviewUrl = $state<string | null>(null);

  // Create preview URL for pending file
  $effect(() => {
    if (pendingMode && pendingFile) {
      const url = URL.createObjectURL(pendingFile);
      pendingPreviewUrl = url;
      return () => URL.revokeObjectURL(url);
    } else {
      pendingPreviewUrl = null;
    }
  });

  const iconUrl = $derived(
    pendingMode
      ? pendingPreviewUrl
      : currentIconPath
        ? `/api/uploads/${currentIconPath}?v=${cacheKey}`
        : null,
  );

  function validateFile(file: File): string | null {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Invalid file type. Use PNG, JPG, SVG, or WebP.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File too large (max 5MB).';
    }
    return null;
  }

  async function processFile(file: File) {
    const error = validateFile(file);
    if (error) {
      toast.error(error);
      return;
    }

    // In pending mode, just store the file for later upload
    if (pendingMode) {
      pendingFile = file;
      return;
    }

    if (!airlineId) return;

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
    }
  }

  async function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    target.value = '';
    if (!file) return;
    await processFile(file);
  }

  function handlePaste(event: ClipboardEvent) {
    if (!pendingMode && !airlineId) return;
    if (uploading || removing) return;

    const items = event.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        event.preventDefault();
        const file = item.getAsFile();
        if (file) {
          processFile(file);
        }
        return;
      }
    }
  }

  async function handleRemove() {
    // In pending mode, just clear the pending file
    if (pendingMode) {
      pendingFile = null;
      return;
    }

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
    if (!uploading && !removing && (pendingMode || airlineId)) {
      fileInput.click();
    }
  }
</script>

<svelte:window onpaste={handlePaste} />

<input
  bind:this={fileInput}
  type="file"
  accept=".png,.jpg,.jpeg,.svg,.webp"
  onchange={handleFileSelect}
  class="hidden"
  disabled={!pendingMode && !airlineId}
/>

<div class="flex items-start gap-4">
  <!-- Preview/Upload Area -->
  <button
    type="button"
    onclick={triggerUpload}
    disabled={(!pendingMode && !airlineId) || uploading || removing}
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
        disabled={uploading || removing || (!pendingMode && !airlineId)}
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
      PNG, JPG, SVG, or WebP. Max 5MB.<br />
      You can also paste from clipboard.
    </p>
  </div>
</div>
