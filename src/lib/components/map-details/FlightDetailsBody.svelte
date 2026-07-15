<script lang="ts">
  import { List } from '@o7/icon/lucide';

  import { Button } from '$lib/components/ui/button';
  import { formatAircraft } from '$lib/utils/data/aircraft';
  import {
    formatSeatForUser,
    getSeatPassengerLabel,
    toTitleCase,
    type FlightData,
  } from '$lib/utils';
  import type { FlightSeat } from '$lib/db/types';
  import { Duration } from '$lib/utils/datetime';
  import { convertDistance, distanceUnitLabel } from '$lib/utils/preferences';
  import type { Preferences } from '$lib/zod/user';

  let {
    flight,
    prefs,
    seatUserId,
    onShowInList,
  }: {
    flight: FlightData;
    prefs: Preferences;
    seatUserId?: string;
    onShowInList: () => void;
  } = $props();

  const distanceLabel = $derived(
    typeof flight.distance === 'number'
      ? `${Math.round(convertDistance(flight.distance, prefs))} ${distanceUnitLabel(prefs)}`
      : null,
  );

  const durationLabel = $derived(
    flight.duration ? Duration.fromSeconds(flight.duration).toString() : null,
  );

  const seatLabel = $derived(formatSeatForUser(flight, seatUserId));

  const seatDescriptor = (seat: FlightSeat) => {
    const t = (s: string) => toTitleCase(s);
    if (seat.seat && seat.seatNumber && seat.seatClass) {
      return `${t(seat.seatClass)} · ${seat.seat} ${seat.seatNumber}`;
    }
    if (seat.seat && seat.seatNumber) return `${seat.seat} ${seat.seatNumber}`;
    if (seat.seat && seat.seatClass)
      return `${t(seat.seatClass)} · ${seat.seat}`;
    if (seat.seatNumber) return seat.seatNumber;
    if (seat.seatClass) return t(seat.seatClass);
    if (seat.seat) return t(seat.seat);
    return null;
  };

  const passengers = $derived(
    flight.seats
      .map((seat) => ({
        name: getSeatPassengerLabel(seat),
        seat: seatDescriptor(seat),
      }))
      .filter((p): p is { name: string; seat: string | null } => !!p.name),
  );

  const gateLabel = (terminal: string | null, gate: string | null) => {
    const parts: string[] = [];
    if (terminal) parts.push(`Terminal ${terminal}`);
    if (gate) parts.push(`Gate ${gate}`);
    return parts.length ? parts.join(' · ') : null;
  };

  const departureGate = $derived(
    gateLabel(flight.departureTerminal, flight.departureGate),
  );
  const arrivalGate = $derived(
    gateLabel(flight.arrivalTerminal, flight.arrivalGate),
  );

  type Row = { label: string; value: string };
  const rows = $derived.by(() => {
    const r: Row[] = [];
    if (flight.airline?.name)
      r.push({ label: 'Airline', value: flight.airline.name });
    if (flight.aircraft || flight.aircraftReg)
      r.push({ label: 'Aircraft', value: formatAircraft(flight) });
    if (distanceLabel) r.push({ label: 'Distance', value: distanceLabel });
    if (durationLabel) r.push({ label: 'Duration', value: durationLabel });
    if (seatLabel) r.push({ label: 'Seat', value: seatLabel });
    if (flight.flightReason)
      r.push({ label: 'Reason', value: toTitleCase(flight.flightReason) });
    if (departureGate) r.push({ label: 'Departure', value: departureGate });
    if (arrivalGate) r.push({ label: 'Arrival', value: arrivalGate });
    return r;
  });
</script>

<section class="flex flex-col gap-3 px-4 py-4">
  {#if rows.length}
    <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      {#each rows as row (row.label)}
        <dt class="text-muted-foreground">{row.label}</dt>
        <dd class="text-right font-medium tabular-nums">{row.value}</dd>
      {/each}
    </dl>
  {/if}

  {#if passengers.length}
    <div class="flex flex-col gap-1.5">
      <p class="text-xs tracking-wider text-muted-foreground uppercase">
        Passengers
      </p>
      <div class="flex flex-wrap gap-1.5">
        {#each passengers as passenger, i (i)}
          <span
            class="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-2 py-0.5 text-xs"
          >
            {passenger.name}
            {#if passenger.seat}
              <span class="text-muted-foreground tabular-nums">
                {passenger.seat}
              </span>
            {/if}
          </span>
        {/each}
      </div>
    </div>
  {/if}

  {#if flight.note}
    <div class="flex flex-col gap-1.5">
      <p class="text-xs tracking-wider text-muted-foreground uppercase">Note</p>
      <p class="text-sm whitespace-pre-wrap text-muted-foreground">
        {flight.note}
      </p>
    </div>
  {/if}

  {#if !rows.length && !passengers.length && !flight.note}
    <p class="py-1 text-sm text-muted-foreground">
      No additional details for this flight.
    </p>
  {/if}
</section>

<section class="px-4 py-3">
  <Button
    variant="ghost"
    size="sm"
    class="w-full justify-center gap-2 text-muted-foreground hover:text-foreground"
    onclick={onShowInList}
  >
    <List size={16} />
    Open list
  </Button>
</section>
