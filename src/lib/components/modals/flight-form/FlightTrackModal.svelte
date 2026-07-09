<script lang="ts">
  import { FileUp, Route, Trash2 } from '@o7/icon/lucide';
  import type { SuperForm } from 'sveltekit-superforms';

  import { Button } from '$lib/components/ui/button';
  import { Modal, ModalBody, ModalHeader } from '$lib/components/ui/modal';
  import { parseTrackFile } from '$lib/track/parser';
  import type { FlightTrackInput } from '$lib/track/schema';
  import { isSmallScreen } from '$lib/utils/size';
  import type { FlightFormData } from '$lib/zod/flight';

  let {
    form,
  }: {
    form: SuperForm<FlightFormData>;
  } = $props();

  const { form: formData } = form;

  let open = $state(false);
  let fileInput: HTMLInputElement | null = $state(null);
  let parsing = $state(false);
  let error: string | null = $state(null);
  let originalPointCount: number | null = $state(null);

  const track = $derived($formData.track);
  const hasTrack = $derived(!!track);
  const trackSummary = $derived.by(() => {
    if (!track) return null;
    const altitudePoints = track.coordinates.filter(
      (coordinate) => coordinate[2] !== undefined,
    ).length;
    return {
      name: track.sourceName ?? `${track.sourceFormat.toUpperCase()} track`,
      points: track.coordinates.length,
      altitudePoints,
      hasTimes: Boolean(track.times?.length),
      hasGroundSpeed: Boolean(track.groundSpeedKt?.length),
      hasTrackDegrees: Boolean(track.trackDeg?.length),
      hasGroundFlags: Boolean(track.ground?.length),
      hasEstimatedFlags: Boolean(track.estimated?.length),
      sourceFormat: track.sourceFormat.toUpperCase(),
    };
  });

  const setTrack = (nextTrack: FlightTrackInput | null) => {
    formData.update((current) => ({
      ...current,
      track: nextTrack,
    }));
  };

  const handleFileChange = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    parsing = true;
    error = null;
    originalPointCount = null;

    try {
      const parsed = await parseTrackFile(file);
      const { originalPointCount: count, ...trackInput } = parsed;
      originalPointCount = count;
      setTrack(trackInput);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to parse track file';
    } finally {
      parsing = false;
      input.value = '';
    }
  };
</script>

<Button
  size={$isSmallScreen ? 'sm' : 'icon-sm'}
  variant="outline"
  class={hasTrack ? 'border-primary text-primary' : ''}
  onclick={() => {
    open = true;
  }}
>
  <Route size={16} />
  {#if $isSmallScreen}
    Flight Track
  {/if}
</Button>

<Modal bind:open class="max-w-md" closeOnOutsideClick={false}>
  <ModalHeader class="pb-0">
    <h2 class="text-lg font-medium">Flight Track</h2>
  </ModalHeader>
  <ModalBody class="overflow-x-hidden">
    <div class="grid min-w-0 gap-4">
      <div class="space-y-1">
        <p class="text-sm text-muted-foreground">
          Add a GPX, KML, FR24 CSV, or FlightAware CSV track to draw the actual
          flown route.
        </p>
      </div>

      <input
        bind:this={fileInput}
        class="sr-only"
        type="file"
        accept=".gpx,.kml,.csv"
        onchange={handleFileChange}
      />

      {#if trackSummary}
        <div
          class="min-w-0 overflow-hidden rounded-md border bg-muted/30 px-3 py-2 text-sm shadow-xs"
          data-testid="flight-track-summary"
        >
          <div class="flex min-w-0 items-start gap-3">
            <Route size={16} class="mt-0.5 shrink-0 text-primary" />
            <div class="min-w-0 flex-1">
              <div class="flex min-w-0 items-center gap-2">
                <p class="min-w-0 truncate font-medium">
                  {trackSummary.name}
                </p>
                <span
                  class="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground"
                >
                  {trackSummary.sourceFormat}
                </span>
              </div>
              <p class="mt-0.5 text-xs text-muted-foreground tabular-nums">
                {trackSummary.points} points
                {#if originalPointCount && originalPointCount !== trackSummary.points}
                  from {originalPointCount}
                {/if}
                {#if trackSummary.altitudePoints}
                  &middot; altitude
                {/if}
                {#if trackSummary.hasTimes}
                  &middot; timestamps stored
                {/if}
                {#if trackSummary.hasGroundSpeed}
                  &middot; speed
                {/if}
                {#if trackSummary.hasTrackDegrees}
                  &middot; heading
                {/if}
                {#if trackSummary.hasGroundFlags}
                  &middot; ground flags
                {/if}
                {#if trackSummary.hasEstimatedFlags}
                  &middot; uncertainty flags
                {/if}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              class="shrink-0 self-center"
              onclick={() => {
                originalPointCount = null;
                setTrack(null);
              }}
              title="Remove track"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        </div>
      {:else}
        <div
          class="rounded-md border border-dashed px-3 py-5 text-center text-sm text-muted-foreground"
        >
          No track attached
        </div>
      {/if}

      {#if error}
        <p class="text-xs font-medium text-destructive">{error}</p>
      {/if}
    </div>
  </ModalBody>
  <div class="flex justify-between gap-2 px-6 pb-4">
    <Button
      type="button"
      variant="outline"
      size="sm"
      loading={parsing}
      onclick={() => fileInput?.click()}
    >
      <FileUp size={14} />
      {hasTrack ? 'Replace' : 'Upload'}
    </Button>
    <Button size="sm" onclick={() => (open = false)}>Done</Button>
  </div>
</Modal>
