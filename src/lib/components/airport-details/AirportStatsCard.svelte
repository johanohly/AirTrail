<script lang="ts">
  import { PlaneLanding, PlaneTakeoff } from '@o7/icon/lucide';
  import NumberFlow from '@number-flow/svelte';

  import { cn, type FlightData } from '$lib/utils';
  import { formatAsFlightDate, parseLocalizeISO } from '$lib/utils/datetime';

  let {
    flights,
    airportId,
    airlineCount,
    now,
  }: {
    flights: FlightData[];
    airportId: number;
    airlineCount: number;
    now: Date;
  } = $props();

  type Visit = { label: string; time: number };

  const getVisitSummary = (flights: FlightData[], id: number, now: Date) => {
    let last: Visit | null = null;
    let next: Visit | null = null;

    for (const flight of flights) {
      const touches = [
        [
          flight.from?.id === id,
          flight.departure,
          flight.departureScheduled,
          flight.from?.tz,
        ],
        [
          flight.to?.id === id,
          flight.arrival,
          flight.arrivalScheduled,
          flight.to?.tz,
        ],
      ] as const;

      for (const [matches, actual, scheduled, tz] of touches) {
        if (!matches) continue;
        const exact =
          actual ??
          (scheduled ? parseLocalizeISO(scheduled, tz ?? 'UTC') : null);
        const start = exact ?? flight.dateStart;
        const end = exact ?? flight.dateEnd;
        const date = exact ?? flight.date;
        if (!start || !end || !date) continue;

        const label = formatAsFlightDate(
          date,
          flight.datePrecision ?? 'day',
          false,
          true,
        );

        if (end < now && (!last || end.getTime() > last.time)) {
          last = { label, time: end.getTime() };
        } else if (start > now && (!next || start.getTime() < next.time)) {
          next = { label, time: start.getTime() };
        }
      }
    }
    return { last, next };
  };

  const departures = $derived(
    flights.filter((f) => f.from?.id === airportId).length,
  );
  const arrivals = $derived(
    flights.filter((f) => f.to?.id === airportId).length,
  );

  const distinctRoutes = $derived.by(() => {
    const set = new Set<string>();
    for (const f of flights) {
      if (!f.from || !f.to) continue;
      const key = [f.from.id, f.to.id].sort().join('-');
      set.add(key);
    }
    return set.size;
  });

  const visits = $derived(getVisitSummary(flights, airportId, now));
  const lastVisitLabel = $derived(visits.last?.label ?? null);
  const nextVisitLabel = $derived(visits.next?.label ?? null);
</script>

<section class="px-4 py-4">
  <h3 class="text-xs uppercase tracking-wider text-muted-foreground mb-2.5">
    Your activity
  </h3>

  <div class="grid grid-cols-2 gap-2">
    <div
      class="rounded-lg border border-border/60 bg-background/40 px-3 py-2.5"
    >
      <div class="flex items-center gap-1.5 text-muted-foreground">
        <PlaneTakeoff size={13} />
        <span class="text-xs">Departures</span>
      </div>
      <p class="text-2xl font-semibold leading-none mt-1.5 tabular-nums">
        <NumberFlow value={departures} />
      </p>
    </div>
    <div
      class="rounded-lg border border-border/60 bg-background/40 px-3 py-2.5"
    >
      <div class="flex items-center gap-1.5 text-muted-foreground">
        <PlaneLanding size={13} />
        <span class="text-xs">Arrivals</span>
      </div>
      <p class="text-2xl font-semibold leading-none mt-1.5 tabular-nums">
        <NumberFlow value={arrivals} />
      </p>
    </div>
  </div>

  {#if lastVisitLabel && nextVisitLabel}
    <div
      class="flex flex-wrap items-center gap-x-2 gap-y-1 mt-3 text-xs text-muted-foreground"
    >
      <span>
        last visit <span class="text-foreground">{lastVisitLabel}</span>
      </span>
      <span class="inline-flex items-center gap-2">
        <span aria-hidden="true">·</span>
        <span>
          next visit <span class="text-foreground">{nextVisitLabel}</span>
        </span>
      </span>
    </div>
  {/if}

  <div
    class={cn(
      'flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground',
      lastVisitLabel && nextVisitLabel ? 'mt-1' : 'mt-3',
    )}
  >
    <span>
      <span class="font-semibold text-foreground tabular-nums">
        {airlineCount}
      </span>
      airlines
    </span>
    <span class="inline-flex items-center gap-2">
      <span aria-hidden="true">·</span>
      <span>
        <span class="font-semibold text-foreground tabular-nums">
          {distinctRoutes}
        </span>
        routes
      </span>
    </span>
    {#if Boolean(lastVisitLabel) !== Boolean(nextVisitLabel)}
      <span class="inline-flex items-center gap-2">
        <span aria-hidden="true">·</span>
        <span>
          {lastVisitLabel ? 'last' : 'next'} visit
          <span class="text-foreground">
            {lastVisitLabel ?? nextVisitLabel}
          </span>
        </span>
      </span>
    {/if}
  </div>
</section>
