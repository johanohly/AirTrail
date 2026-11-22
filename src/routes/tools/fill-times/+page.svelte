<script lang="ts">
  import { TZDate } from '@date-fns/tz';
  import { toast } from 'svelte-sonner';
  import { SvelteSet } from 'svelte/reactivity';

  import type { PageProps } from './$types';

  import { invalidateAll } from '$app/navigation';
  import { TimeDisplay } from '$lib/components/display';
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import * as Table from '$lib/components/ui/table';
  import type {
    TrackTimeFill,
    TrackTimeFillSide,
  } from '$lib/server/utils/track-event-times';
  import { api } from '$lib/trpc';
  import { invalidateFlightData } from '$lib/trpc/invalidation';
  import { prepareFlightData } from '$lib/utils';
  import {
    formatFlightDate,
    formatTime,
    getPreferences,
  } from '$lib/utils/preferences';

  let { data }: PageProps = $props();
  const prefs = $derived(getPreferences(data.user));

  type Side = 'takeoff' | 'landing';

  const FLIGHT_REASONS: Partial<Record<string, string>> = {
    mismatch: "Track is over 24 h from the flight's times",
    'inexact-date': 'Flight has no exact date',
    'no-times': 'Track has no timestamps',
    'invalid-track': "Track can't be read",
  };
  const SIDE_REASONS: Record<string, Record<Side, string>> = {
    'in-air': {
      takeoff: 'Track starts in the air',
      landing: 'Track ends in the air',
    },
    'not-detected': {
      takeoff: 'No clear takeoff',
      landing: 'No clear landing',
    },
    'no-airport': { takeoff: 'No airport', landing: 'No airport' },
    order: { takeoff: 'After the landing', landing: 'Before the takeoff' },
  };

  const reasonLabel = (fill: TrackTimeFillSide, side: Side) => {
    if (!fill.reason) return null;
    return (
      FLIGHT_REASONS[fill.reason] ?? SIDE_REASONS[fill.reason]?.[side] ?? null
    );
  };

  const rows = $derived.by(() => {
    const flights = prepareFlightData(data.fills.map((fill) => fill.flight));
    const all = data.fills.map((fill, i) => ({
      ...fill,
      prepared: flights[i]!,
      fillable: fill.takeoff.fill || fill.landing.fill,
    }));
    return [
      ...all.filter((row) => row.fillable),
      ...all.filter((row) => !row.fillable),
    ];
  });
  const fillableIds = $derived(
    rows.filter((row) => row.fillable).map((row) => row.flight.id),
  );

  const selected = new SvelteSet<number>();
  const allSelected = $derived(
    fillableIds.length > 0 && fillableIds.every((id) => selected.has(id)),
  );
  const someSelected = $derived(fillableIds.some((id) => selected.has(id)));

  const toggleAll = (value: boolean) => {
    for (const id of fillableIds) {
      if (value) selected.add(id);
      else selected.delete(id);
    }
  };

  /** A flight-level reason covers both time columns. */
  const sharedReason = (row: TrackTimeFill) => {
    const takeoff = !row.takeoff.current && reasonLabel(row.takeoff, 'takeoff');
    const landing = !row.landing.current && reasonLabel(row.landing, 'landing');
    return takeoff && takeoff === landing ? takeoff : null;
  };

  const minute = (iso: string) => Math.floor(Date.parse(iso) / 60_000);
  /** The calendar day of a time at the airport, to flag a different day. */
  const localDay = (iso: string, tz: string | null | undefined) =>
    new TZDate(iso, tz ?? 'UTC').toISOString().slice(0, 10);

  let filling = $state(false);
  const fillTimes = async () => {
    filling = true;
    try {
      const ids = fillableIds.filter((id) => selected.has(id));
      const { filled } = await api.flightTrack.fillTimes.mutate(ids);
      if (filled) {
        toast.success(
          `Filled times on ${filled} ${filled === 1 ? 'flight' : 'flights'}`,
        );
      } else {
        toast.info('No times filled');
      }
    } catch {
      toast.error("Couldn't fill times");
    } finally {
      selected.clear();
      await Promise.all([invalidateAll(), invalidateFlightData()]);
      filling = false;
    }
  };
</script>

{#snippet sideCell(
  fill: TrackTimeFillSide,
  side: Side,
  tz: string | null | undefined,
  label: string | null | undefined,
  flightDate: string,
)}
  {@const shown = fill.current ?? (fill.fill ? fill.detected : null)}
  {@const otherDay = shown && localDay(shown, tz) !== flightDate.slice(0, 10)}
  {#if shown}
    <div class="flex flex-col gap-0.5">
      <TimeDisplay
        date={new Date(shown)}
        airportTz={tz}
        airportLabel={label}
        variant={otherDay ? 'datetime' : 'time'}
        dateStyle="compact"
        class="tabular-nums"
      />
      <span class="text-xs text-muted-foreground">
        {#if !fill.current}
          New
        {:else if fill.detected && minute(fill.detected) !== minute(fill.current)}
          Already set · track {formatTime(
            new Date(fill.detected),
            prefs,
            tz ?? 'UTC',
          )}
        {:else}
          Already set
        {/if}
      </span>
    </div>
  {:else}
    <span class="text-muted-foreground">{reasonLabel(fill, side) ?? '—'}</span>
  {/if}
{/snippet}

<div
  class="container h-full flex flex-col items-center justify-center gap-2 pb-24 md:pb-0"
>
  <h1 class="text-2xl font-medium">Fill Times from Tracks</h1>
  <p class="text-sm text-muted-foreground pb-8 text-center max-w-prose">
    Takeoff and landing times detected from saved tracks, for flights that are
    missing them. Times that are already set are never changed.
  </p>
  <div
    class="max-w-full rounded-md border [&>div]:max-h-[calc(100vh-350px)] max-md:[&_td]:px-2 max-md:[&_th]:px-2"
  >
    <Table.Root class="md:whitespace-nowrap">
      <Table.Header>
        <Table.Row>
          <Table.Head>
            <Checkbox
              class="align-middle"
              checked={allSelected}
              indeterminate={someSelected && !allSelected}
              disabled={!fillableIds.length}
              onCheckedChange={(value) => toggleAll(!!value)}
              aria-label="Select all"
            />
          </Table.Head>
          <Table.Head class="md:hidden">Flight</Table.Head>
          <Table.Head class="hidden md:table-cell">Origin</Table.Head>
          <Table.Head class="hidden md:table-cell">Destination</Table.Head>
          <Table.Head class="hidden md:table-cell">Date</Table.Head>
          <Table.Head>Takeoff</Table.Head>
          <Table.Head>Landing</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each rows as row (row.flight.id)}
          {@const from = row.flight.from}
          {@const to = row.flight.to}
          {@const shared = sharedReason(row)}
          {@const date = row.prepared.date
            ? formatFlightDate(
                row.prepared.date,
                row.flight.datePrecision,
                prefs,
              )
            : ''}
          <Table.Row data-state={selected.has(row.flight.id) && 'selected'}>
            <Table.Cell>
              <Checkbox
                class="align-middle"
                checked={selected.has(row.flight.id)}
                disabled={!row.fillable}
                onCheckedChange={(value) =>
                  value
                    ? selected.add(row.flight.id)
                    : selected.delete(row.flight.id)}
                aria-label="Select row"
              />
            </Table.Cell>
            <Table.Cell class="md:hidden">
              <div class="whitespace-nowrap">
                {from?.iata ?? from?.icao ?? ''} → {to?.iata ?? to?.icao ?? ''}
              </div>
              <div class="text-xs text-muted-foreground">{date}</div>
            </Table.Cell>
            <Table.Cell class="hidden md:table-cell">
              {from?.iata ?? from?.icao ?? ''}
            </Table.Cell>
            <Table.Cell class="hidden md:table-cell">
              {to?.iata ?? to?.icao ?? ''}
            </Table.Cell>
            <Table.Cell class="hidden md:table-cell">{date}</Table.Cell>
            {#if shared}
              <Table.Cell colspan={2} class="text-muted-foreground">
                {shared}
              </Table.Cell>
            {:else}
              <Table.Cell>
                {@render sideCell(
                  row.takeoff,
                  'takeoff',
                  from?.tz,
                  from?.iata,
                  row.flight.date,
                )}
              </Table.Cell>
              <Table.Cell>
                {@render sideCell(
                  row.landing,
                  'landing',
                  to?.tz,
                  to?.iata,
                  row.flight.date,
                )}
              </Table.Cell>
            {/if}
          </Table.Row>
        {:else}
          <Table.Row>
            <Table.Cell colspan={6} class="h-12 text-center">
              No flights with a saved track are missing times.
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>
  <Button onclick={fillTimes} disabled={!someSelected || filling}>
    Fill Times
  </Button>
</div>
