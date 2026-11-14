<script lang="ts">
  import { FileUp, PlaneTakeoff, Route, Trash2 } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';
  import type { SuperForm } from 'sveltekit-superforms';

  import { page } from '$app/state';
  import { Button } from '$lib/components/ui/button';
  import { Modal, ModalBody, ModalHeader } from '$lib/components/ui/modal';
  import { findAutomaticTrackCandidate } from '$lib/track/candidates';
  import {
    clearTrackEventTimes,
    prepareTrackEventTimes,
  } from '$lib/track/event-times';
  import { findTrackMismatches, type TrackMetadata } from '$lib/track/metadata';
  import { parseTrackFile, type ParsedTrackCandidate } from '$lib/track/parser';
  import type { FlightTrackInput } from '$lib/track/schema';
  import {
    formatDateTime,
    formatTime,
    getPreferences,
  } from '$lib/utils/preferences';
  import { isSmallScreen } from '$lib/utils/size';
  import type { FlightFormData } from '$lib/zod/flight';

  import FlightMergeConflictModal from './FlightMergeConflictModal.svelte';
  import {
    buildTrackTimesMergePlan,
    isConflict,
    type MergeChoices,
    type MergeField,
  } from './merge-fields';

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
  let trackCandidates: ParsedTrackCandidate[] = $state([]);
  let formSnapshot = $state.raw<ReturnType<typeof form.capture> | null>(null);
  let filledTimes = $state<Partial<FlightFormData>>({});
  let filledTimesSnapshot = $state<Partial<FlightFormData>>({});
  let metadata = $state.raw<TrackMetadata | null>(null);
  let metadataSnapshot = $state.raw<TrackMetadata | null>(null);
  // When set, the conflict picker is shown; `resolve` returns the user's
  // per-field choices, or null if they cancelled.
  let mergeState = $state<{
    fields: MergeField[];
    applied: MergeField[];
    resolve: (choices: MergeChoices | null) => void;
  } | null>(null);

  const TIME_FIELDS = [
    'takeoffActual',
    'takeoffActualTime',
    'landingActual',
    'landingActualTime',
  ] as const;

  const prefs = $derived(getPreferences(page.data.user));
  const filledTimesNote = $derived.by(() => {
    const takeoff = Boolean(
      filledTimes.takeoffActual &&
      filledTimes.takeoffActual === $formData.takeoffActual &&
      filledTimes.takeoffActualTime === $formData.takeoffActualTime,
    );
    const landing = Boolean(
      filledTimes.landingActual &&
      filledTimes.landingActual === $formData.landingActual &&
      filledTimes.landingActualTime === $formData.landingActualTime,
    );
    if (takeoff && landing)
      return 'Takeoff and landing times filled from track.';
    if (takeoff) return 'Takeoff time filled from track.';
    if (landing) return 'Landing time filled from track.';
    return null;
  });

  const track = $derived($formData.track);
  const hasTrack = $derived(!!track);
  const timingWarnings = $derived(
    track ? prepareTrackEventTimes(track, $formData).warnings : [],
  );
  const mismatches = $derived(findTrackMismatches(metadata, $formData));
  const hasWarnings = $derived(
    timingWarnings.length > 0 || mismatches.length > 0,
  );
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
      ...clearTrackEventTimes(current, filledTimes),
      track: nextTrack,
    }));
    filledTimes = {};
    metadata = null;
  };

  const automaticCandidate = (candidates: ParsedTrackCandidate[]) => {
    return findAutomaticTrackCandidate(candidates, {
      from: $formData.from,
      to: $formData.to,
    });
  };

  const formatLegRange = (candidate: ParsedTrackCandidate) => {
    if (candidate.startTime === null || candidate.endTime === null) {
      return 'Time unavailable';
    }
    const start = formatDateTime(
      new Date(candidate.startTime * 1_000),
      prefs,
      'UTC',
    );
    const end = formatDateTime(
      new Date(candidate.endTime * 1_000),
      prefs,
      'UTC',
    );
    return `${start} UTC – ${end} UTC`;
  };

  const applyCandidate = (candidate: ParsedTrackCandidate) => {
    const { originalPointCount: count, ...trackInput } = candidate.track;
    originalPointCount = count;
    trackCandidates = [];
    setTrack(trackInput);
    metadata = candidate.metadata ?? null;
    // A track from another route shouldn't fill this flight's times. A flight
    // number mismatch alone can be a codeshare, so it only warns.
    if (
      findTrackMismatches(metadata, $formData).some(
        (mismatch) => mismatch.field !== 'flightNumber',
      )
    )
      return;
    void applyDetectedTimes(trackInput, { quiet: true });
  };

  const toField = ({
    key,
    label,
    currentDisplay,
    fetchedDisplay,
  }: MergeField): MergeField => ({
    key,
    label,
    currentDisplay,
    fetchedDisplay,
  });

  /**
   * Detect takeoff and landing from the track and merge them into the form.
   * Empty fields are filled, and differing values go to the conflict picker.
   * `quiet` (on upload) only reports a fill, as an upload did before.
   */
  const applyDetectedTimes = async (
    trackInput: FlightTrackInput,
    { quiet }: { quiet: boolean },
  ) => {
    if ($formData.datePrecision !== 'day') {
      if (!quiet) {
        toast.info('Times can only be detected for flights with an exact date');
      }
      return;
    }
    const { detected, warnings } = prepareTrackEventTimes(
      trackInput,
      $formData,
    );
    if (warnings.length) {
      if (!quiet) {
        toast.warning("Times not filled: the track doesn't match this flight");
      }
      return;
    }

    const plan = buildTrackTimesMergePlan({
      current: $formData,
      detected,
      formatTime: (date) => formatTime(date, prefs, date.timeZone),
    });
    const conflicts = plan.states.filter(isConflict);
    const applied = plan.states.filter(
      (state) => state.fetchedPresent && !isConflict(state),
    );
    const added = applied.filter((state) => !state.currentPresent);

    if (!applied.length && !conflicts.length) {
      if (!quiet) toast.info('No takeoff or landing found in this track');
      return;
    }
    if (!added.length && !conflicts.length) {
      if (!quiet) toast.info('Times already match the track');
      return;
    }

    let choices: MergeChoices = {};
    if (conflicts.length) {
      const resolved = await new Promise<MergeChoices | null>((resolve) => {
        mergeState = {
          fields: conflicts.map(toField),
          applied: added.map(toField),
          resolve,
        };
      });
      mergeState = null;
      if (!resolved) return;
      choices = resolved;
    }

    const patch = plan.buildPatch(choices);
    formData.update((current) => ({ ...current, ...patch }));

    // Remember only the values the track supplied, so removing or replacing
    // the track clears them but never a value the user kept or typed.
    const filled: Partial<FlightFormData> = {};
    for (const state of [...added, ...conflicts]) {
      if (isConflict(state) && choices[state.key] !== 'fetched') continue;
      const key = state.key as 'takeoffActual' | 'landingActual';
      filled[key] = patch[key];
      filled[`${key}Time`] = patch[`${key}Time`];
    }
    filledTimes = { ...filledTimes, ...filled };

    if (Object.keys(filled).length) toast.success('Times filled from track');
  };

  // The file input has no `accept` filter because iOS has no system type for
  // GPX or KML and greys those files out in the picker. `parseTrackFile`
  // rejects unsupported files instead.
  const handleFileChange = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    parsing = true;
    error = null;
    originalPointCount = null;
    trackCandidates = [];

    try {
      const candidates = await parseTrackFile(file);
      const candidate = automaticCandidate(candidates);
      if (candidate) applyCandidate(candidate);
      else trackCandidates = candidates;
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
  class={hasWarnings
    ? 'relative overflow-visible border-amber-500 text-amber-600 dark:text-amber-400'
    : hasTrack
      ? 'border-primary text-primary'
      : ''}
  aria-label={hasWarnings
    ? 'Flight track, may not match this flight'
    : 'Flight track'}
  onclick={() => {
    formSnapshot = form.capture();
    filledTimesSnapshot = { ...filledTimes };
    metadataSnapshot = metadata;
    open = true;
  }}
>
  <Route size={16} />
  {#if $isSmallScreen}
    Flight Track
  {/if}
  {#if hasWarnings}
    <span
      class="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white"
      aria-hidden="true"
    >
      !
    </span>
  {/if}
</Button>

<Modal
  bind:open
  dismissal="form"
  dirty={formSnapshot !== null &&
    (JSON.stringify(track) !== JSON.stringify(formSnapshot.data.track) ||
      TIME_FIELDS.some(
        (field) => $formData[field] !== formSnapshot?.data[field],
      ))}
  busy={parsing}
  onDiscard={() => {
    if (formSnapshot) form.restore(formSnapshot);
    filledTimes = { ...filledTimesSnapshot };
    metadata = metadataSnapshot;
    error = null;
    originalPointCount = null;
    trackCandidates = [];
  }}
  class="max-w-md"
>
  <ModalHeader class="pb-0">
    <h2 class="text-lg font-medium">Flight Track</h2>
  </ModalHeader>
  <ModalBody class="overflow-x-hidden">
    <div class="grid min-w-0 gap-4">
      <div class="space-y-1">
        <p class="text-sm text-muted-foreground">
          Add a GPX, KML, CSV, or readsb trace JSON track to draw the actual
          flown route.
        </p>
      </div>

      <input
        bind:this={fileInput}
        class="sr-only"
        type="file"
        onchange={handleFileChange}
      />

      {#if trackCandidates.length > 1}
        <div class="space-y-2 rounded-md border bg-muted/20 p-3">
          <div>
            <p class="text-sm font-medium">Choose a flight leg</p>
            <p class="mt-0.5 text-xs text-muted-foreground">
              This trace contains {trackCandidates.length} recorded legs and none
              matched the selected route uniquely.
            </p>
          </div>
          <div class="grid gap-1.5">
            {#each trackCandidates as candidate (candidate.legIndex)}
              <button
                type="button"
                class="flex w-full items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-left transition-colors hover:bg-muted"
                onclick={() => applyCandidate(candidate)}
              >
                <span class="min-w-0">
                  <span class="block text-xs font-medium">
                    Leg {candidate.legIndex}
                  </span>
                  <span
                    class="block truncate text-[11px] text-muted-foreground"
                  >
                    {formatLegRange(candidate)}
                  </span>
                </span>
                <span
                  class="shrink-0 text-[11px] tabular-nums text-muted-foreground"
                >
                  {candidate.track.coordinates.length.toLocaleString()} points
                </span>
              </button>
            {/each}
          </div>
        </div>
      {/if}

      {#if trackSummary}
        {#if filledTimesNote}
          <p role="status" class="text-sm text-muted-foreground">
            {filledTimesNote}
          </p>
        {/if}
        {#each timingWarnings as warning}
          <p role="alert" class="text-sm text-amber-600 dark:text-amber-400">
            {warning}
          </p>
        {/each}
        {#if mismatches.length}
          <div role="alert" class="text-sm text-amber-600 dark:text-amber-400">
            <p>This track may belong to a different flight.</p>
            <ul class="mt-1 space-y-0.5 text-xs">
              {#each mismatches as mismatch (mismatch.field)}
                <li class="break-words">
                  {mismatch.label}: {mismatch.track} in the track, {mismatch.entered}
                  entered
                </li>
              {/each}
            </ul>
          </div>
        {/if}
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
                trackCandidates = [];
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
    <div class="flex gap-2">
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
      {#if track}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={parsing || !trackSummary?.hasTimes}
          title={trackSummary?.hasTimes
            ? 'Detect takeoff and landing times from this track'
            : 'This track has no timestamps'}
          onclick={() => applyDetectedTimes(track, { quiet: false })}
        >
          <PlaneTakeoff size={14} />
          Detect times
        </Button>
      {/if}
    </div>
    <Button size="sm" disabled={parsing} onclick={() => (open = false)}
      >Done</Button
    >
  </div>
</Modal>

{#if mergeState}
  <FlightMergeConflictModal
    open={true}
    fields={mergeState.fields}
    applied={mergeState.applied}
    description="The times detected from the track differ from the current values."
    fetchedLabel="Track"
    appliedLabel="Also filled in from the track"
    onResolve={(choices) => mergeState?.resolve(choices)}
    onCancel={() => mergeState?.resolve(null)}
  />
{/if}
