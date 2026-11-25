<script lang="ts">
  import { RefreshCw } from '@o7/icon/lucide';
  import { writable } from 'svelte/store';

  import BackupRoutes from './BackupRoutes.svelte';
  import EmptyState from './EmptyState.svelte';
  import FlightSelector from './FlightSelector.svelte';
  import RotationView from './RotationView.svelte';

  import { Modal } from '$lib/components/ui/modal';
  import { trpc } from '$lib/trpc';
  import { cn } from '$lib/utils';

  let { open = $bindable<boolean>() }: { open?: boolean } = $props();

  const upcomingQuery = trpc.liveStatus.listUpcoming.query();
  const upcoming = $derived($upcomingQuery.data ?? []);

  // tRPC input store for the rotation query. Always populated with something
  // (so the type stays narrow); the query is gated by the reactive `enabled`
  // flag below until we actually have a selected flight.
  const rotationInput = writable<{
    flightNumber: string;
    originIata: string;
    destinationIata: string;
    originTz: string;
    schedDepIso: string;
  }>({
    flightNumber: '',
    originIata: 'XXX',
    destinationIata: 'XXX',
    originTz: 'UTC',
    schedDepIso: new Date().toISOString(),
  });

  // Reactive options store. trpc-svelte-query wraps plain-object options in
  // `readable()` at construction, capturing their values once — passing a
  // writable store instead lets us flip `enabled` after the upcoming-flights
  // list resolves and a selection lands.
  //
  // staleTime + gcTime are Infinity so the rotation never auto-refetches and
  // never falls out of the cache. Combined with the localStorage persister
  // wired up in +layout.svelte, this means: the first time the user opens
  // the modal for a given flight we hit FR24; thereafter the cached response
  // is served from memory or localStorage on every subsequent modal open
  // (even across browser sessions and reloads), until the user explicitly
  // hits the refresh button which calls $rotationQuery.refetch().
  const rotationOptions = writable({
    enabled: false,
    refetchOnWindowFocus: false,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  });

  const rotationQuery = trpc.liveStatus.getRotation.query(
    rotationInput,
    rotationOptions,
  );

  // Rule 2b — hide any flight whose cached FR24 rotation has already recorded
  // an actual arrival timestamp. This is the "FR24 says landed" backstop that
  // lets the modal drop a completed flight even when the user hasn't logged
  // the arrival in JTrail (and we intentionally don't auto-write to
  // `flight.arrival`, since that column is user-owned).
  //
  // The cache is populated lazily — a flight only has a cached rotation once
  // the user has actually opened this modal on that flight and either loaded
  // fresh data or hit refresh. So a landed flight the user hasn't opened yet
  // will stay visible until Rule 3 (scheduledArrival + 6 h) kicks in
  // server-side. That's the intended tradeoff for not fanning out FR24 calls.
  //
  // We touch `$rotationQuery.data` inside the derive so the filter re-runs
  // whenever the currently-selected flight's rotation refetches — otherwise
  // Svelte wouldn't know the cache had changed underneath us.
  const filteredUpcoming = $derived.by(() => {
    void $rotationQuery.data;
    return upcoming.filter((f) => {
      const cached = trpc.liveStatus.getRotation.utils.getData({
        flightNumber: f.flightNumber,
        originIata: f.from.iata,
        destinationIata: f.to.iata,
        originTz: f.from.tz,
        schedDepIso: f.departureScheduled,
      });
      if (cached?.kind === 'ok' && cached.yourLeg.realArr != null) {
        return false;
      }
      return true;
    });
  });

  // Default selection to the next-soonest upcoming flight. If the currently
  // selected flight drops out of the filtered list (either because
  // listUpcoming refetched without it or Rule 2b just fired), fall through
  // to the next candidate. filteredUpcoming is ordered by scheduled dep ASC.
  let selectedId = $state<number | null>(null);
  $effect(() => {
    const stillPresent = filteredUpcoming.some((f) => f.id === selectedId);
    if (!stillPresent) {
      selectedId = filteredUpcoming[0]?.id ?? null;
    }
  });

  const selected = $derived(
    filteredUpcoming.find((f) => f.id === selectedId) ?? null,
  );

  $effect(() => {
    if (selected) {
      rotationInput.set({
        flightNumber: selected.flightNumber,
        originIata: selected.from.iata,
        destinationIata: selected.to.iata,
        originTz: selected.from.tz,
        schedDepIso: selected.departureScheduled,
      });
    }
  });

  $effect(() => {
    rotationOptions.update((o) => ({
      ...o,
      enabled: !!selected && !!open,
    }));
  });

  const rotation = $derived($rotationQuery.data);
  const isRotationLoading = $derived($rotationQuery.isLoading);
  const isRotationError = $derived($rotationQuery.isError);
  // isFetching is true during both the initial load AND subsequent refetches,
  // so we use it to disable/animate the refresh button regardless of whether
  // we already have data on screen. tanstack-query keeps the existing `data`
  // value in place while a refetch is in flight, so the rotation view stays
  // visible — only the button itself reflects the pending state.
  const isRotationFetching = $derived($rotationQuery.isFetching);
</script>

<Modal bind:open class="max-w-2xl" closeButton>
  <div class="space-y-4 p-2 sm:p-4">
    <header class="flex items-start justify-between gap-3">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">Live status</h2>
        <p class="text-sm text-muted-foreground">
          Real-time rotation history for the aircraft assigned to your upcoming
          flights.
        </p>
      </div>
      <!-- Manual refresh. Disabled while a fetch is already in flight so
           rapid clicks don't queue up extra calls to FR24. The icon spins
           via Tailwind's animate-spin during fetch. tanstack-query keeps
           the current rotation on screen until the new data arrives, so
           the user never sees a blank/loading state mid-refresh. -->
      <button
        type="button"
        aria-label="Refresh live status"
        title="Refresh"
        class="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-hover hover:text-foreground transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
        disabled={isRotationFetching || !rotation}
        onclick={() => $rotationQuery.refetch()}
      >
        <RefreshCw size="16" class={cn(isRotationFetching && 'animate-spin')} />
      </button>
    </header>

    {#if $upcomingQuery.isLoading}
      <p class="text-sm text-muted-foreground py-8 text-center">
        Loading upcoming flights…
      </p>
    {:else if $upcomingQuery.isError}
      <div
        class="rounded-md border border-destructive/40 bg-destructive/10 p-4"
      >
        <p class="text-sm font-medium">Couldn't load upcoming flights</p>
        <p class="text-xs text-muted-foreground mt-1">
          {$upcomingQuery.error?.message ?? 'Unknown error'}
        </p>
      </div>
    {:else if filteredUpcoming.length === 0}
      <EmptyState />
    {:else}
      <FlightSelector
        flights={filteredUpcoming}
        {selectedId}
        onSelect={(id) => (selectedId = id)}
      />

      {#if isRotationLoading}
        <p class="text-sm text-muted-foreground py-8 text-center">
          Fetching from FlightRadar24…
        </p>
      {:else if isRotationError}
        <div
          class="rounded-md border border-destructive/40 bg-destructive/10 p-4"
        >
          <p class="text-sm font-medium">FlightRadar24 unreachable</p>
          <p class="text-xs text-muted-foreground mt-1">
            Hit the refresh button to try again, or close and reopen the modal.
          </p>
        </div>
      {:else if rotation?.kind === 'tail_not_found'}
        <div class="rounded-md border border-border bg-card/40 p-4">
          <p class="text-sm font-medium">Not tracked by FlightRadar24</p>
          <p class="text-xs text-muted-foreground mt-1">
            This flight isn't on the {selected?.from.iata} departures board or the
            {selected?.to.iata} arrivals board right now. If your flight is still
            upcoming, aircraft assignments usually appear within ~12 hours of departure
            — check back closer to your flight time. If your flight already landed,
            FR24 may have aged it out of the live boards.
          </p>
        </div>
      {:else if rotation?.kind === 'ok'}
        <RotationView
          yourLeg={rotation.yourLeg}
          priorLegs={rotation.priorLegs}
          flightStatsUrl={rotation.flightStatsUrl}
        />
        {#if rotation.backupRoutes.length > 0}
          <BackupRoutes
            routes={rotation.backupRoutes}
            userSchedDep={rotation.yourLeg.schedDep}
            userFlightNumber={rotation.yourLeg.flightNumber}
          />
        {/if}
        <footer class="text-xs text-muted-foreground text-right">
          Updated {new Date(rotation.fetchedAt).toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
          })}
        </footer>
      {/if}
    {/if}
  </div>
</Modal>
