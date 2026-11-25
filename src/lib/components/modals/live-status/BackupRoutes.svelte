<script lang="ts">
  import { ChevronDown, ChevronRight } from '@o7/icon/lucide';

  import type { FR24Leg } from '$lib/server/utils/fr24';
  import { Switch } from '$lib/components/ui/switch';

  // Render an FR24 unix-seconds timestamp as a 12-hour local time
  // ("8:00 PM") in the given IANA tz. hour12 is forced rather than left to
  // the browser locale so non-US locales still render in the same style.
  function fmtTime(ts: number | null, tz: string | null): string {
    if (!ts) return '--';
    return new Date(ts * 1000).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: tz ?? undefined,
    });
  }

  // Strip parenthetical livery / variant descriptors from FR24's airline
  // name. "Frontier (Pike the Otter Livery)" → "Frontier". The user wants
  // the carrier name only; the livery is noise in the backup-routes list.
  function cleanAirline(name: string): string {
    return name.replace(/\s*\([^)]*\)\s*/g, '').trim();
  }

  // Days between the route's scheduled departure and the user's own
  // scheduled departure, both interpreted as calendar dates in the origin
  // airport's tz. Returns 0 for same-day, +1 for next-day, etc. Used to
  // annotate departure times with the standard airline "+1" notation when
  // a backup leaves on a different calendar day than the user's flight.
  function daysOffset(
    routeTs: number | null,
    userTs: number | null,
    tz: string | null,
  ): number {
    if (!routeTs || !userTs || !tz) return 0;
    const a = new Date(routeTs * 1000).toLocaleDateString('en-CA', {
      timeZone: tz,
    });
    const b = new Date(userTs * 1000).toLocaleDateString('en-CA', {
      timeZone: tz,
    });
    if (a === b) return 0;
    const ad = Date.parse(`${a}T00:00:00Z`);
    const bd = Date.parse(`${b}T00:00:00Z`);
    return Math.round((ad - bd) / 86400000);
  }

  let {
    routes,
    userSchedDep,
    userFlightNumber,
  }: {
    routes: FR24Leg[];
    userSchedDep: number | null;
    userFlightNumber: string;
  } = $props();

  let expanded = $state(false);
  // Default behavior: only show same-carrier alternatives (the realistic
  // rebooking case). Toggling the switch widens the list to every eligible
  // route across all carriers — useful if the user is willing to pay for
  // a competitor or hold a credit.
  let allCarriers = $state(false);

  const carrierPrefix = $derived(userFlightNumber.slice(0, 2).toUpperCase());

  const visibleRoutes = $derived.by(() => {
    if (allCarriers || !carrierPrefix) return routes;
    return routes.filter(
      (r) => r.flightNumber.slice(0, 2).toUpperCase() === carrierPrefix,
    );
  });
</script>

<section class="rounded-lg border border-border bg-card/40">
  <button
    type="button"
    class="w-full flex items-center justify-between p-3 text-left hover:bg-hover transition-colors rounded-lg"
    onclick={() => (expanded = !expanded)}
  >
    <span class="text-sm font-semibold">
      Backup routes
      <span class="text-muted-foreground font-normal">
        ({visibleRoutes.length})
      </span>
    </span>
    {#if expanded}
      <ChevronDown size="16" class="text-muted-foreground" />
    {:else}
      <ChevronRight size="16" class="text-muted-foreground" />
    {/if}
  </button>

  {#if expanded}
    <div
      class="flex items-center justify-between border-t border-border px-3 py-2"
    >
      <span class="text-xs text-muted-foreground"> All carriers </span>
      <Switch bind:checked={allCarriers} />
    </div>
    <div class="border-t border-border divide-y divide-border">
      {#if visibleRoutes.length === 0}
        <p class="p-3 text-xs text-muted-foreground">
          No same-carrier alternatives. Toggle "All carriers" above to see
          options from other airlines.
        </p>
      {/if}
      {#each visibleRoutes as r, i (i)}
        {@const offset = daysOffset(r.schedDep, userSchedDep, r.originTz)}
        <div class="flex items-center justify-between gap-3 p-3 text-sm">
          <div class="min-w-0">
            <div class="font-medium truncate">
              {cleanAirline(r.airline)}
              <span class="text-muted-foreground font-normal ml-1">
                {r.flightNumber}
              </span>
            </div>
            <div class="text-xs text-muted-foreground">
              Departs {fmtTime(r.schedDep, r.originTz)}{#if offset > 0}
                <span class="ml-1 font-medium">+{offset}</span>
              {/if}
            </div>
          </div>
          <span class="text-xs text-muted-foreground truncate max-w-[12rem]">
            Est. {fmtTime(r.estDep, r.originTz)}
          </span>
        </div>
      {/each}
    </div>
  {/if}
</section>
