<script lang="ts">
  import { PlaneLanding, PlaneTakeoff } from '@o7/icon/lucide';
  import NumberFlow from '@number-flow/svelte';
  import { isAfter, isBefore } from 'date-fns';

  import { cn, type FlightData } from '$lib/utils';
  import { formatAsFlightDate, nowIn } from '$lib/utils/datetime';

  let {
    flights,
    airportId,
    airlineCount,
  }: {
    flights: FlightData[];
    airportId: number;
    airlineCount: number;
  } = $props();

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

  // The moment this flight actually touches the airport: landing time when
  // arriving here, takeoff time when departing from here.
  const touchTime = (f: FlightData) =>
    (f.to?.id === airportId
      ? (f.arrival ?? f.dateEnd)
      : (f.departure ?? f.dateStart)) ?? f.date;

  const lastVisit = $derived.by(() => {
    const now = nowIn('UTC');
    let best: FlightData | null = null;
    let bestDate: ReturnType<typeof touchTime> = null;
    for (const f of flights) {
      const date = touchTime(f);
      if (
        date &&
        isBefore(date, now) &&
        (!bestDate || isAfter(date, bestDate))
      ) {
        bestDate = date;
        best = f;
      }
    }
    return best;
  });

  const nextVisit = $derived.by(() => {
    const now = nowIn('UTC');
    let best: FlightData | null = null;
    let bestDate: ReturnType<typeof touchTime> = null;
    for (const f of flights) {
      const date = touchTime(f);
      if (
        date &&
        isAfter(date, now) &&
        (!bestDate || isBefore(date, bestDate))
      ) {
        bestDate = date;
        best = f;
      }
    }
    return best;
  });

  const formatVisit = (flight: FlightData | null) => {
    if (!flight) return null;
    const date = touchTime(flight);
    if (!date) return null;
    return formatAsFlightDate(
      date,
      flight.datePrecision ?? 'day',
      false,
      true,
    );
  };

  const lastVisitLabel = $derived(formatVisit(lastVisit));
  const nextVisitLabel = $derived(formatVisit(nextVisit));
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

  {#if lastVisitLabel || nextVisitLabel}
    <div
      class="flex flex-wrap items-center gap-x-2 gap-y-1 mt-3 text-xs text-muted-foreground"
    >
      {#if lastVisitLabel}
        <span>
          last visit <span class="text-foreground">{lastVisitLabel}</span>
        </span>
      {/if}
      {#if nextVisitLabel}
        <span class="inline-flex items-center gap-2">
          {#if lastVisitLabel}
            <span aria-hidden="true">·</span>
          {/if}
          <span>
            next visit <span class="text-foreground">{nextVisitLabel}</span>
          </span>
        </span>
      {/if}
    </div>
  {/if}

  <div
    class={cn(
      'flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground',
      lastVisitLabel || nextVisitLabel ? 'mt-1' : 'mt-3',
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
  </div>
</section>
