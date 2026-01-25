<script lang="ts">
  import type { TZDate } from '@date-fns/tz';
  import { differenceInSeconds } from 'date-fns';
  import type { SuperForm } from 'sveltekit-superforms';
  import { z } from 'zod';

  import TimetableDateTimeCell from './TimetableDateTimeCell.svelte';

  import { Label } from '$lib/components/ui/label';
  import * as Tabs from '$lib/components/ui/tabs';
  import { Duration, mergeTimeWithDate } from '$lib/utils/datetime';
  import type { flightSchema } from '$lib/zod/flight';

  let {
    form,
  }: {
    form: SuperForm<z.infer<typeof flightSchema>>;
  } = $props();

  const { form: formData } = form as SuperForm<any>;
  const formValues = $derived.by(() => $formData as Record<string, any>);

  let mobileTab: 'scheduled' | 'actual' = $state('actual');

  const fallbackTimezone =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'UTC';

  const getDateTime = (
    date: string | null,
    time: string | null,
    tzId?: string | null,
  ) => {
    if (!date || !time) return null;
    const timezone = tzId ?? fallbackTimezone;
    try {
      return mergeTimeWithDate(date, time, timezone);
    } catch {
      return null;
    }
  };

  const calcDuration = (start: TZDate | null, end: TZDate | null) => {
    if (!start || !end) return null;
    const seconds = differenceInSeconds(end, start);
    return seconds >= 0 ? seconds : null;
  };

  const formatDuration = (seconds: number | null) => {
    if (seconds === null) return '—';
    return Duration.fromSeconds(seconds).toString();
  };

  const gateDepartureActual = $derived.by(() =>
    getDateTime(
      formValues.departure,
      formValues.departureTime,
      formValues.from?.tz,
    ),
  );
  const gateDepartureScheduled = $derived.by(() =>
    getDateTime(
      formValues.departureScheduled,
      formValues.departureScheduledTime,
      formValues.from?.tz,
    ),
  );
  const takeoffScheduled = $derived.by(() =>
    getDateTime(
      formValues.takeoffScheduled,
      formValues.takeoffScheduledTime,
      formValues.from?.tz,
    ),
  );
  const takeoffActual = $derived.by(() =>
    getDateTime(
      formValues.takeoffActual,
      formValues.takeoffActualTime,
      formValues.from?.tz,
    ),
  );
  const landingScheduled = $derived.by(() =>
    getDateTime(
      formValues.landingScheduled,
      formValues.landingScheduledTime,
      formValues.to?.tz,
    ),
  );
  const landingActual = $derived.by(() =>
    getDateTime(
      formValues.landingActual,
      formValues.landingActualTime,
      formValues.to?.tz,
    ),
  );
  const gateArrivalActual = $derived.by(() =>
    getDateTime(formValues.arrival, formValues.arrivalTime, formValues.to?.tz),
  );
  const gateArrivalScheduled = $derived.by(() =>
    getDateTime(
      formValues.arrivalScheduled,
      formValues.arrivalScheduledTime,
      formValues.to?.tz,
    ),
  );

  const taxiOutScheduled = $derived.by(() =>
    calcDuration(gateDepartureScheduled, takeoffScheduled),
  );
  const taxiOutActual = $derived.by(() =>
    calcDuration(gateDepartureActual, takeoffActual),
  );
  const airTimeScheduled = $derived.by(() =>
    calcDuration(takeoffScheduled, landingScheduled),
  );
  const airTimeActual = $derived.by(() =>
    calcDuration(takeoffActual, landingActual),
  );
  const taxiInScheduled = $derived.by(() =>
    calcDuration(landingScheduled, gateArrivalScheduled),
  );
  const taxiInActual = $derived.by(() =>
    calcDuration(landingActual, gateArrivalActual),
  );
  const totalTimeScheduled = $derived.by(() =>
    calcDuration(gateDepartureScheduled, gateArrivalScheduled),
  );
  const totalTimeActual = $derived.by(() =>
    calcDuration(gateDepartureActual, gateArrivalActual),
  );
</script>

<!-- Desktop layout (md+) -->
<div class="hidden md:block rounded-xl bg-card/70 py-4">
  <div class="space-y-1">
    <div
      class="grid grid-cols-[1.2fr_1fr_1fr] gap-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
    >
      <div></div>
      <div>Scheduled</div>
      <div>Actual</div>
    </div>
    <div class="space-y-1">
      <div class="grid grid-cols-[1.2fr_1fr_1fr] items-start gap-3">
        <div class="flex h-8 items-center">
          <Label>Gate departure</Label>
        </div>
        <TimetableDateTimeCell
          {form}
          label="Gate departure"
          dateField="departureScheduled"
          timeField="departureScheduledTime"
          timezone={$formData.from?.tz}
          baseDateTime={gateDepartureScheduled}
          defaultDate={$formData.takeoffScheduled}
          defaultTime={$formData.takeoffScheduledTime}
        />
        <TimetableDateTimeCell
          {form}
          label="Gate departure"
          dateField="departure"
          timeField="departureTime"
          timezone={$formData.from?.tz}
          baseDateTime={gateDepartureActual}
          compareDateTime={gateDepartureScheduled}
          defaultDate={$formData.takeoffActual ?? $formData.departureScheduled}
          defaultTime={$formData.takeoffActualTime ??
            $formData.departureScheduledTime}
        />
      </div>
      <div class="grid grid-cols-[1.2fr_1fr_1fr] items-start gap-3">
        <div class="flex h-8 items-center">
          <Label class="text-muted-foreground">Taxi out</Label>
        </div>
        <div class="flex h-8 items-center px-2 text-sm text-muted-foreground">
          {formatDuration(taxiOutScheduled)}
        </div>
        <div class="flex h-8 items-center px-2 text-sm text-muted-foreground">
          {formatDuration(taxiOutActual)}
        </div>
      </div>
      <div class="grid grid-cols-[1.2fr_1fr_1fr] items-start gap-3">
        <div class="flex h-8 items-center">
          <Label>Takeoff</Label>
        </div>
        <TimetableDateTimeCell
          {form}
          label="Takeoff"
          dateField="takeoffScheduled"
          timeField="takeoffScheduledTime"
          timezone={$formData.from?.tz}
          baseDateTime={gateDepartureScheduled}
          defaultDate={$formData.departureScheduled}
          defaultTime={$formData.departureScheduledTime}
        />
        <TimetableDateTimeCell
          {form}
          label="Takeoff"
          dateField="takeoffActual"
          timeField="takeoffActualTime"
          timezone={$formData.from?.tz}
          baseDateTime={gateDepartureActual}
          compareDateTime={takeoffScheduled}
          defaultDate={$formData.departure}
          defaultTime={$formData.departureTime}
        />
      </div>
      <div
        class="grid grid-cols-[1.2fr_1fr_1fr] items-start gap-3 pt-3 mt-3 border-t border-border/60"
      >
        <div class="flex h-8 items-center">
          <Label>Landing</Label>
        </div>
        <TimetableDateTimeCell
          {form}
          label="Landing"
          dateField="landingScheduled"
          timeField="landingScheduledTime"
          timezone={$formData.to?.tz}
          baseDateTime={gateDepartureScheduled}
          defaultDate={$formData.arrivalScheduled}
          defaultTime={$formData.arrivalScheduledTime}
        />
        <TimetableDateTimeCell
          {form}
          label="Landing"
          dateField="landingActual"
          timeField="landingActualTime"
          timezone={$formData.to?.tz}
          baseDateTime={gateDepartureActual}
          compareDateTime={landingScheduled}
          defaultDate={$formData.arrival}
          defaultTime={$formData.arrivalTime}
        />
      </div>
      <div class="grid grid-cols-[1.2fr_1fr_1fr] items-start gap-3">
        <div class="flex h-8 items-center">
          <Label class="text-muted-foreground">Taxi in</Label>
        </div>
        <div class="flex h-8 items-center px-2 text-sm text-muted-foreground">
          {formatDuration(taxiInScheduled)}
        </div>
        <div class="flex h-8 items-center px-2 text-sm text-muted-foreground">
          {formatDuration(taxiInActual)}
        </div>
      </div>
      <div class="grid grid-cols-[1.2fr_1fr_1fr] items-start gap-3">
        <div class="flex h-8 items-center">
          <Label>Gate arrival</Label>
        </div>
        <TimetableDateTimeCell
          {form}
          label="Gate arrival"
          dateField="arrivalScheduled"
          timeField="arrivalScheduledTime"
          timezone={$formData.to?.tz}
          baseDateTime={gateDepartureScheduled}
          defaultDate={$formData.landingScheduled}
          defaultTime={$formData.landingScheduledTime}
        />
        <TimetableDateTimeCell
          {form}
          label="Gate arrival"
          dateField="arrival"
          timeField="arrivalTime"
          timezone={$formData.to?.tz}
          baseDateTime={gateDepartureActual}
          compareDateTime={gateArrivalScheduled}
          defaultDate={$formData.landingActual}
          defaultTime={$formData.landingActualTime}
        />
      </div>
      <div
        class="grid grid-cols-[1.2fr_1fr_1fr] items-center gap-3 mt-3 pt-3 border-t border-border/60"
      >
        <div class="flex h-8 items-center">
          <Label class="text-muted-foreground">Air time</Label>
        </div>
        <div class="flex h-8 items-center px-2 text-sm text-muted-foreground">
          {formatDuration(airTimeScheduled)}
        </div>
        <div class="flex h-8 items-center px-2 text-sm text-muted-foreground">
          {formatDuration(airTimeActual)}
        </div>
      </div>
      <div class="grid grid-cols-[1.2fr_1fr_1fr] items-center gap-3">
        <div class="flex h-8 items-center">
          <Label class="text-muted-foreground">Total time</Label>
        </div>
        <div class="flex h-8 items-center px-2 text-sm text-muted-foreground">
          {formatDuration(totalTimeScheduled)}
        </div>
        <div class="flex h-8 items-center px-2 text-sm text-muted-foreground">
          {formatDuration(totalTimeActual)}
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Mobile layout (below md) - tabbed -->
<div class="md:hidden rounded-xl bg-card/70 py-4">
  <!-- Tab switcher -->
  <Tabs.Root bind:value={mobileTab} class="w-full mb-3">
    <Tabs.List class="w-full">
      <Tabs.Trigger value="scheduled">Scheduled</Tabs.Trigger>
      <Tabs.Trigger value="actual">Actual</Tabs.Trigger>
    </Tabs.List>
  </Tabs.Root>

  <div class="space-y-1">
    <!-- Gate departure -->
    <div class="grid grid-cols-[1fr_1fr] items-start gap-3">
      <div class="flex h-8 items-center">
        <Label>Gate departure</Label>
      </div>
      {#if mobileTab === 'scheduled'}
        <TimetableDateTimeCell
          {form}
          label="Gate departure"
          dateField="departureScheduled"
          timeField="departureScheduledTime"
          timezone={$formData.from?.tz}
          baseDateTime={gateDepartureScheduled}
          defaultDate={$formData.takeoffScheduled}
          defaultTime={$formData.takeoffScheduledTime}
        />
      {:else}
        <TimetableDateTimeCell
          {form}
          label="Gate departure"
          dateField="departure"
          timeField="departureTime"
          timezone={$formData.from?.tz}
          baseDateTime={gateDepartureActual}
          compareDateTime={gateDepartureScheduled}
          defaultDate={$formData.takeoffActual ?? $formData.departureScheduled}
          defaultTime={$formData.takeoffActualTime ??
            $formData.departureScheduledTime}
        />
      {/if}
    </div>

    <!-- Taxi out -->
    <div class="grid grid-cols-[1fr_1fr] items-start gap-3">
      <div class="flex h-8 items-center">
        <Label class="text-muted-foreground">Taxi out</Label>
      </div>
      <div class="flex h-8 items-center px-2 text-sm text-muted-foreground">
        {formatDuration(
          mobileTab === 'scheduled' ? taxiOutScheduled : taxiOutActual,
        )}
      </div>
    </div>

    <!-- Takeoff -->
    <div class="grid grid-cols-[1fr_1fr] items-start gap-3">
      <div class="flex h-8 items-center">
        <Label>Takeoff</Label>
      </div>
      {#if mobileTab === 'scheduled'}
        <TimetableDateTimeCell
          {form}
          label="Takeoff"
          dateField="takeoffScheduled"
          timeField="takeoffScheduledTime"
          timezone={$formData.from?.tz}
          baseDateTime={gateDepartureScheduled}
          defaultDate={$formData.departureScheduled}
          defaultTime={$formData.departureScheduledTime}
        />
      {:else}
        <TimetableDateTimeCell
          {form}
          label="Takeoff"
          dateField="takeoffActual"
          timeField="takeoffActualTime"
          timezone={$formData.from?.tz}
          baseDateTime={gateDepartureActual}
          compareDateTime={takeoffScheduled}
          defaultDate={$formData.departure}
          defaultTime={$formData.departureTime}
        />
      {/if}
    </div>

    <!-- Landing -->
    <div
      class="grid grid-cols-[1fr_1fr] items-start gap-3 pt-3 mt-3 border-t border-border/60"
    >
      <div class="flex h-8 items-center">
        <Label>Landing</Label>
      </div>
      {#if mobileTab === 'scheduled'}
        <TimetableDateTimeCell
          {form}
          label="Landing"
          dateField="landingScheduled"
          timeField="landingScheduledTime"
          timezone={$formData.to?.tz}
          baseDateTime={gateDepartureScheduled}
          defaultDate={$formData.arrivalScheduled}
          defaultTime={$formData.arrivalScheduledTime}
        />
      {:else}
        <TimetableDateTimeCell
          {form}
          label="Landing"
          dateField="landingActual"
          timeField="landingActualTime"
          timezone={$formData.to?.tz}
          baseDateTime={gateDepartureActual}
          compareDateTime={landingScheduled}
          defaultDate={$formData.arrival}
          defaultTime={$formData.arrivalTime}
        />
      {/if}
    </div>

    <!-- Taxi in -->
    <div class="grid grid-cols-[1fr_1fr] items-start gap-3">
      <div class="flex h-8 items-center">
        <Label class="text-muted-foreground">Taxi in</Label>
      </div>
      <div class="flex h-8 items-center px-2 text-sm text-muted-foreground">
        {formatDuration(
          mobileTab === 'scheduled' ? taxiInScheduled : taxiInActual,
        )}
      </div>
    </div>

    <!-- Gate arrival -->
    <div class="grid grid-cols-[1fr_1fr] items-start gap-3">
      <div class="flex h-8 items-center">
        <Label>Gate arrival</Label>
      </div>
      {#if mobileTab === 'scheduled'}
        <TimetableDateTimeCell
          {form}
          label="Gate arrival"
          dateField="arrivalScheduled"
          timeField="arrivalScheduledTime"
          timezone={$formData.to?.tz}
          baseDateTime={gateDepartureScheduled}
          defaultDate={$formData.landingScheduled}
          defaultTime={$formData.landingScheduledTime}
        />
      {:else}
        <TimetableDateTimeCell
          {form}
          label="Gate arrival"
          dateField="arrival"
          timeField="arrivalTime"
          timezone={$formData.to?.tz}
          baseDateTime={gateDepartureActual}
          compareDateTime={gateArrivalScheduled}
          defaultDate={$formData.landingActual}
          defaultTime={$formData.landingActualTime}
        />
      {/if}
    </div>

    <!-- Air time -->
    <div
      class="grid grid-cols-[1fr_1fr] items-center gap-3 mt-3 pt-3 border-t border-border/60"
    >
      <div class="flex h-8 items-center">
        <Label class="text-muted-foreground">Air time</Label>
      </div>
      <div class="flex h-8 items-center px-2 text-sm text-muted-foreground">
        {formatDuration(
          mobileTab === 'scheduled' ? airTimeScheduled : airTimeActual,
        )}
      </div>
    </div>

    <!-- Total time -->
    <div class="grid grid-cols-[1fr_1fr] items-center gap-3">
      <div class="flex h-8 items-center">
        <Label class="text-muted-foreground">Total time</Label>
      </div>
      <div class="flex h-8 items-center px-2 text-sm text-muted-foreground">
        {formatDuration(
          mobileTab === 'scheduled' ? totalTimeScheduled : totalTimeActual,
        )}
      </div>
    </div>
  </div>
</div>
