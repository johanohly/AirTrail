<script lang="ts">
  import { differenceInSeconds } from 'date-fns';
  import type { SuperForm } from 'sveltekit-superforms';

  import FlightInformation from './FlightInformation.svelte';
  import FlightNumber from './FlightNumber.svelte';
  import FlightTimetable from './FlightTimetable.svelte';
  import SeatInformation from './SeatInformation.svelte';

  import { confirmation } from '$lib/components/helpers/confirm';
  import { AirportField, DateTimeField } from '$lib/components/form-fields';
  import { mergeTimeWithDate } from '$lib/utils/datetime';
  import type { FlightFormData } from '$lib/zod/flight';

  let {
    form,
  }: {
    form: SuperForm<FlightFormData>;
  } = $props();

  const { form: formData } = form;
  type TimetableTab = 'scheduled' | 'actual';

  const MAX_DURATION_SECONDS = 24 * 60 * 60;

  const timetableDateFields = [
    'departureScheduled',
    'arrivalScheduled',
    'takeoffScheduled',
    'takeoffActual',
    'landingScheduled',
    'landingActual',
  ] as const;

  const timetableTimeFields = [
    'departureScheduledTime',
    'arrivalScheduledTime',
    'takeoffScheduledTime',
    'takeoffActualTime',
    'landingScheduledTime',
    'landingActualTime',
  ] as const;

  const clearedByPartialDateFields = [
    'arrival',
    'departureTime',
    'arrivalTime',
    ...timetableDateFields,
    ...timetableTimeFields,
  ] as const;

  const hasTimetableData = $derived.by(() => {
    return (
      timetableDateFields.some((field) => !!$formData[field]) ||
      timetableTimeFields.some((field) => !!$formData[field])
    );
  });

  const hasClearableDateTimeData = $derived.by(() => {
    return clearedByPartialDateFields.some((field) => !!$formData[field]);
  });

  let showTimetable = $state(false);
  let partialDateMode = $state($formData.datePrecision !== 'day');
  let prevHasTimetableData = $state(false);
  let preferredMobileTab = $state<TimetableTab>('actual');
  let preferredMobileTabVersion = $state(0);

  const clearDetailedTimetable = () => {
    formData.update((current) => ({
      ...current,
      arrival: null,
      departureTime: null,
      arrivalTime: null,
      departureScheduled: null,
      departureScheduledTime: null,
      arrivalScheduled: null,
      arrivalScheduledTime: null,
      takeoffScheduled: null,
      takeoffScheduledTime: null,
      takeoffActual: null,
      takeoffActualTime: null,
      landingScheduled: null,
      landingScheduledTime: null,
      landingActual: null,
      landingActualTime: null,
    }));
  };

  const toPartialDepartureAnchor = (departure: string | null) => {
    if (!departure) return null;

    const [year, month] = departure.slice(0, 10).split('-');
    if (!year || !month) return null;

    return new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toISOString();
  };

  const enablePartialDateMode = async () => {
    if (
      hasClearableDateTimeData &&
      !(await confirmation.show({
        title: 'Switch to partial date?',
        description:
          'This will clear the arrival date, current times, and detailed timetable.',
        confirmText: 'Switch',
        cancelText: 'Cancel',
      }))
    ) {
      return;
    }

    partialDateMode = true;
    showTimetable = false;
    formData.update((current) => ({
      ...current,
      datePrecision: current.departure ? 'month' : 'year',
      departure: current.departure
        ? toPartialDepartureAnchor(current.departure)
        : current.departure,
    }));
    clearDetailedTimetable();
  };

  const disablePartialDateMode = () => {
    partialDateMode = false;
    formData.update((current) => ({
      ...current,
      datePrecision: 'day',
    }));
  };

  function handleLookupApplied(tab: TimetableTab) {
    preferredMobileTab = tab;
    preferredMobileTabVersion += 1;
    showTimetable = true;
    partialDateMode = false;
    formData.update((current) => ({
      ...current,
      datePrecision: 'day',
    }));
  }

  // Auto-open timetable when data is populated (e.g., from flight lookup)
  $effect(() => {
    if (hasTimetableData && !prevHasTimetableData) {
      showTimetable = true;
    }
    prevHasTimetableData = hasTimetableData;
  });

  const durationWarning = $derived.by(() => {
    const { departure, departureTime, arrival, arrivalTime, from, to } =
      $formData;
    if (
      !departure ||
      !departureTime ||
      !arrival ||
      !arrivalTime ||
      !from ||
      !to
    ) {
      return null;
    }

    try {
      const dep = mergeTimeWithDate(departure, departureTime, from.tz);
      const arr = mergeTimeWithDate(arrival, arrivalTime, to.tz);
      const duration = differenceInSeconds(arr, dep);

      if (duration > MAX_DURATION_SECONDS) {
        return 'Flight duration exceeds 24 hours';
      }
    } catch {
      return null;
    }

    return null;
  });
</script>

<div
  class="grid w-full gap-y-4 max-md:overflow-auto md:grid-cols-[3fr_2fr] max-md:max-h-[calc(100dvh-200px)] max-md:min-h-[min(566px,_calc(100dvh-200px))]"
>
  <!-- First column: uses contents on mobile to flatten, block on desktop to group -->
  <div
    class="contents md:flex md:min-h-[min(566px,_calc(100dvh-200px))] md:max-h-[calc(100dvh-200px)] md:flex-col md:gap-4 md:overflow-auto md:scrollbar-hide md:px-6 md:py-4"
  >
    <div class="order-1 px-6 md:order-none md:px-0">
      <div class="flex flex-col gap-4 py-4 md:py-0">
        <FlightNumber {form} onLookupApplied={handleLookupApplied} />
        <AirportField field="from" {form} />
        <AirportField field="to" {form} />
        {#if showTimetable && !partialDateMode}
          <FlightTimetable
            {form}
            {preferredMobileTab}
            {preferredMobileTabVersion}
          />
          <button
            type="button"
            class="text-xs text-muted-foreground transition hover:text-foreground text-left"
            onclick={() => (showTimetable = false)}
          >
            Use simple departure/arrival inputs
          </button>
        {:else}
          <DateTimeField
            field="departure"
            {form}
            {partialDateMode}
            onEnablePartialDateMode={enablePartialDateMode}
          />
          {#if !partialDateMode}
            <DateTimeField field="arrival" {form} {partialDateMode} />
          {/if}
          {#if partialDateMode}
            <button
              type="button"
              class="text-xs text-muted-foreground transition hover:text-foreground text-left"
              onclick={disablePartialDateMode}
            >
              Use full departure/arrival datetimes
            </button>
          {:else}
            <button
              type="button"
              class="text-xs text-muted-foreground transition hover:text-foreground text-left"
              onclick={() => (showTimetable = true)}
            >
              Add detailed timetable (taxi, takeoff, landing times...)
            </button>
          {/if}
        {/if}
        {#if durationWarning}
          <p class="text-yellow-500 text-sm font-medium">
            {durationWarning}
          </p>
        {/if}
      </div>
    </div>
    <div class="order-3 px-6 md:order-none md:px-0">
      <div class="flex flex-col gap-4 py-4 md:py-0">
        <FlightInformation {form} />
      </div>
    </div>
  </div>
  <div
    class="order-2 scrollbar-hide px-6 md:order-none md:max-h-[calc(100dvh-200px)] md:min-h-[min(566px,_calc(100dvh-200px))] md:overflow-auto md:pl-0"
  >
    <div class="relative">
      <div
        class="absolute inset-0 rounded-xl border bg-neutral-50 dark:bg-input/30 [mask-image:linear-gradient(to_bottom,black,transparent)]"
      ></div>
      <div class="relative px-4 py-3">
        <SeatInformation {form} />
      </div>
    </div>
  </div>
</div>
