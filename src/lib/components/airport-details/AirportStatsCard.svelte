<script lang="ts">
  import { PlaneLanding, PlaneTakeoff } from '@o7/icon/lucide';
  import NumberFlow from '@number-flow/svelte';

  import type { FlightData } from '$lib/utils';
  import { formatAsFlightDate } from '$lib/utils/datetime';

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

  const mostRecent = $derived.by(() => {
    let best: FlightData | null = null;
    let bestTs = -Infinity;
    for (const f of flights) {
      const ts = f.date?.getTime();
      if (ts && ts > bestTs) {
        bestTs = ts;
        best = f;
      }
    }
    return best;
  });

  const lastVisitLabel = $derived.by(() => {
    if (!mostRecent?.date) return null;
    return formatAsFlightDate(
      mostRecent.date,
      mostRecent.datePrecision ?? 'day',
      false,
      true,
    );
  });
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

  <div
    class="flex flex-wrap items-center gap-x-2 gap-y-1 mt-3 text-xs text-muted-foreground"
  >
    <span>
      <span class="font-semibold text-foreground tabular-nums">
        {airlineCount}
      </span>
      airlines
    </span>
    <span aria-hidden="true">·</span>
    <span>
      <span class="font-semibold text-foreground tabular-nums">
        {distinctRoutes}
      </span>
      routes
    </span>
    {#if lastVisitLabel}
      <span aria-hidden="true">·</span>
      <span
        >last visit <span class="text-foreground">{lastVisitLabel}</span></span
      >
    {/if}
  </div>
</section>
