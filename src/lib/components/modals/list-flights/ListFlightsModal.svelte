<script lang="ts">
  import { tick } from 'svelte';

  import autoAnimate from '@formkit/auto-animate';
  import {
    ArrowLeftRight,
    Plane,
    PlaneTakeoff,
    PlaneLanding,
    X,
  } from '@o7/icon/lucide';
  import { isBefore, differenceInMinutes } from 'date-fns';

  import DeleteFlightModal from './DeleteFlightModal.svelte';
  import EmptyFlightsState from './EmptyFlightsState.svelte';
  import MobileFlightList from './MobileFlightList.svelte';
  import Toolbar from './Toolbar.svelte';

  import { page as appPage } from '$app/state';
  import { AirlineIcon, TimeDisplay } from '$lib/components/display';
  import {
    clearTempFilters as clearTempFilterValues,
    hasTempFilters as hasActiveTempFilters,
    type FlightFilters,
    type TempFilters,
  } from '$lib/components/flight-filters/types';
  import { AddFlightModal, EditFlightModal } from '$lib/components/modals';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import { Card } from '$lib/components/ui/card';
  import { Modal } from '$lib/components/ui/modal';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import { LabelledSeparator, Separator } from '$lib/components/ui/separator';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import {
    flightAddedState,
    flightListFocusState,
    flightScopeState,
  } from '$lib/state.svelte';
  import {
    cn,
    formatSeatForUser,
    getFlightPassengerLabels,
    highlightElement,
    type FlightData,
  } from '$lib/utils';
  import { formatAircraft } from '$lib/utils/data/aircraft';
  import { Duration, parseLocalizeISO } from '$lib/utils/datetime';
  import { formatFlightDate, getPreferences } from '$lib/utils/preferences';
  import { isMediumScreen } from '$lib/utils/size';

  let {
    open = $bindable<boolean>(),
    filters = $bindable<FlightFilters | undefined>(),
    tempFilters = $bindable<TempFilters | undefined>(),
    flights,
    filteredFlights,
    deleteFlight,
    readonly = false,
    seatUserId,
    showPassengerDetails = false,
  }: {
    open?: boolean;
    filters?: FlightFilters;
    tempFilters?: TempFilters;
    flights: FlightData[];
    filteredFlights: FlightData[];
    deleteFlight?: (id: number) => Promise<void>;
    readonly?: boolean;
    seatUserId?: string;
    showPassengerDetails?: boolean;
  } = $props();

  // Renders a positive delay in minutes as "37" under an hour, "1:15" at or above.
  const formatDelay = (minutes: number) => {
    if (minutes < 60) return `${minutes}`;
    const h = Math.floor(minutes / 60);
    const mm = String(minutes % 60).padStart(2, '0');
    return `${h}:${mm}`;
  };

  const prefs = $derived(getPreferences(appPage.data.user));

  const formattedFlights = $derived.by(() => {
    const data = filteredFlights;
    if (!data) return [];

    const nowMs = Date.now();
    // Calendar-date key (YYYY-MM-DD) in the origin airport's tz. Two flights
    // on the same date-in-origin-tz belong to the same trip day even if their
    // UTC dates differ around midnight boundaries.
    const dateKeyInOriginTz = (
      depAt: Date | null,
      tz: string | undefined,
    ): string | null =>
      depAt ? depAt.toLocaleDateString('en-CA', { timeZone: tz }) : null;

    const preliminary = data
      .map((f) => {
        const depDate = f.departure;
        const arrDate = f.arrival;

        // Compare actual vs scheduled times. Tolerances:
        //   Departure: late only (no early branch). If wheels-off is known,
        //   compare it to scheduled gate departure with a 30-min window
        //   (15-min on-time grace + ~15-min taxi). Otherwise compare gate
        //   push-back to scheduled gate departure with a 15-min window.
        //   Arrival: gate-vs-gate. Any amount before scheduled is early,
        //   within 15 min after is on-time, > 15 min after is late.
        const depScheduled =
          f.raw.departureScheduled && f.from
            ? parseLocalizeISO(f.raw.departureScheduled, f.from.tz)
            : null;
        const arrScheduled =
          f.raw.arrivalScheduled && f.to
            ? parseLocalizeISO(f.raw.arrivalScheduled, f.to.tz)
            : null;
        const takeoffActual =
          f.raw.takeoffActual && f.from
            ? parseLocalizeISO(f.raw.takeoffActual, f.from.tz)
            : null;

        let depStatus: 'late' | null = null;
        let depDelayMinutes: number | null = null;
        if (depScheduled) {
          if (takeoffActual) {
            const diff = differenceInMinutes(takeoffActual, depScheduled);
            if (diff > 30) {
              depStatus = 'late';
              depDelayMinutes = diff;
            }
          } else if (depDate) {
            const diff = differenceInMinutes(depDate, depScheduled);
            if (diff > 15) {
              depStatus = 'late';
              depDelayMinutes = diff;
            }
          }
        }

        let arrStatus: 'early' | 'late' | null = null;
        let arrDelayMinutes: number | null = null;
        if (arrDate && arrScheduled) {
          if (isBefore(arrDate, arrScheduled)) {
            arrStatus = 'early';
          } else {
            const diff = differenceInMinutes(arrDate, arrScheduled);
            if (diff > 15) {
              arrStatus = 'late';
              arrDelayMinutes = diff;
            }
          }
        }

        return {
          ...f,
          from: f.from,
          to: f.to,
          duration: f.duration
            ? Duration.fromSeconds(f.duration).toString()
            : '',
          hasDateDisplay: !!f.date,
          depAt: (depDate ?? depScheduled) as Date | null,
          depFallback:
            !(depDate ?? depScheduled) && f.date
              ? formatFlightDate(f.date, f.datePrecision, prefs)
              : null,
          arrAt: (arrDate ?? arrScheduled) as Date | null,
          depStatus,
          arrStatus,
          depDelayMinutes,
          arrDelayMinutes,
          seat: formatSeatForUser(f, seatUserId),
          passengers: showPassengerDetails ? getFlightPassengerLabels(f) : [],
        };
      })
      .sort((a, b) => {
        // Sort DESC by effective departure — later flights first. depAt is
        // the coalesced timestamp (actual gate-out if known, else scheduled),
        // so this stays deterministic for future flights whose actual gate-out
        // hasn't happened yet. Previously the comparator checked a.departure
        // (actual only), which was null for future flights and fell through
        // to a dateStart tie — same-day future flights then landed in
        // whatever order the DB returned, which shifted after any row update.
        if (a.depAt && b.depAt) {
          return isBefore(a.depAt, b.depAt) ? 1 : -1;
        } else if (a.dateStart && b.dateStart) {
          return isBefore(a.dateStart, b.dateStart) ? 1 : -1;
        } else {
          return 0;
        }
      });

    // Highlight the user's next trip. Find the earliest flight whose
    // effective departure (actual > scheduled) is still in the future, take
    // its calendar date in the origin airport's tz, then flag every other
    // upcoming flight that shares that date. Handles the multi-leg trip case:
    // if the next trip is 5 days out with two legs same-day, both light up.
    // Already-taken legs of an in-progress trip stay dim (their depAt is in
    // the past).
    let nextTripDateKey: string | null = null;
    let nextTripTs = Infinity;
    for (const f of preliminary) {
      if (!f.depAt) continue;
      const ts = f.depAt.getTime();
      if (ts > nowMs && ts < nextTripTs) {
        nextTripTs = ts;
        nextTripDateKey = dateKeyInOriginTz(f.depAt, f.from?.tz);
      }
    }

    return preliminary.map((f) => ({
      ...f,
      isNextTrip:
        nextTripDateKey !== null &&
        f.depAt !== null &&
        f.depAt.getTime() > nowMs &&
        dateKeyInOriginTz(f.depAt, f.from?.tz) === nextTripDateKey,
    }));
  });

  const flightsPerPage = 20;
  let page = $state(1);
  const paginatedFlights = $derived.by(() => {
    return formattedFlights.slice(
      (page - 1) * flightsPerPage,
      page * flightsPerPage,
    );
  });

  const flightsByYear = $derived.by(() => {
    const raw = paginatedFlights.reduce(
      (acc, f) => {
        const year = f.date?.getFullYear() ?? 0;
        if (!acc[year]) acc[year] = [];
        acc[year].push(f);
        return acc;
      },
      {} as Record<number, typeof formattedFlights>,
    );
    return Object.entries(raw)
      .sort(([yearA], [yearB]) => Number(yearB) - Number(yearA))
      .map(([year, flights]) => {
        return { year, flights };
      });
  });

  let selecting = $state(false);
  let selectedFlights = $state<number[]>([]);
  let handledFocusRequest = $state(0);

  // Add flight state
  let addFlightOpen = $state(false);

  $effect(() => {
    if (flightAddedState.added && addFlightOpen) {
      addFlightOpen = false;
    }
  });

  $effect(() => {
    if (!open || flightListFocusState.request === handledFocusRequest) return;

    const flightId = flightListFocusState.flightId;
    handledFocusRequest = flightListFocusState.request;
    if (!flightId) return;

    const index = formattedFlights.findIndex(
      (flight) => flight.id === flightId,
    );
    if (index >= 0) page = Math.floor(index / flightsPerPage) + 1;

    const highlightFlight = () =>
      highlightElement(`#flight-list-row-${flightId}`, {
        duration: 1900,
        scrollOffset: -100,
        pulses: 3,
      }).catch(() => {});

    tick().then(() => {
      highlightFlight();
      setTimeout(highlightFlight, 150);
    });
  });

  // Mobile edit state
  let mobileEditFlight = $state<FlightData | null>(null);
  let mobileEditOpen = $state(false);
  // Monotonically-increasing key for the mobile edit modal's {#key} block.
  // Incremented on every open so tapping the SAME flight twice forces a
  // remount of EditFlightModal — which re-runs its initial-form setup
  // against whatever is currently in filteredFlights, picking up any
  // updates from the previous save. Without this, the modal's superForm
  // holds a snapshot of flight.raw from first mount and never refreshes,
  // so newly-saved seats/edits appear absent until a page reload.
  let mobileEditKey = $state(0);

  // Reference to MobileFlightList for resetting swipeable rows
  let mobileFlightListRef: MobileFlightList | undefined = $state();

  const handleMobileEdit = (flight: { id: number }) => {
    const originalFlight = filteredFlights.find((f) => f.id === flight.id);
    if (originalFlight) {
      mobileEditFlight = originalFlight;
      mobileEditKey++;
      mobileEditOpen = true;
    }
  };

  // Delete state (used for both mobile and desktop)
  type DeleteFlight = {
    id: number;
    from: (typeof filteredFlights)[0]['from'];
    to: (typeof filteredFlights)[0]['to'];
    airline: (typeof filteredFlights)[0]['airline'];
  };
  let deleteFlightData = $state<DeleteFlight | null>(null);
  let deleteModalOpen = $state(false);

  // Track previous modal state to detect close transitions
  let prevModalOpen = $state(false);

  // Reset swipeable rows when modals close (transition from open -> closed)
  $effect(() => {
    const isOpen = mobileEditOpen || deleteModalOpen;
    if (prevModalOpen && !isOpen) {
      mobileFlightListRef?.resetAllRows();
    }
    prevModalOpen = isOpen;
  });

  const handleDelete = (flight: { id: number }) => {
    const originalFlight = filteredFlights.find((f) => f.id === flight.id);
    if (originalFlight) {
      deleteFlightData = {
        id: originalFlight.id,
        from: originalFlight.from,
        to: originalFlight.to,
        airline: originalFlight.airline,
      };
      deleteModalOpen = true;
    }
  };

  const confirmDelete = async () => {
    if (deleteFlightData !== null) {
      await deleteFlight?.(deleteFlightData.id);
      deleteFlightData = null;
    }
  };

  const hasTempFilters = $derived.by(() => hasActiveTempFilters(tempFilters));

  const clearTempFilters = () => {
    if (!tempFilters) return;
    clearTempFilterValues(tempFilters);
  };

  const findAirportById = (airportId: string) => {
    const flight = flights.find(
      (f) =>
        f.from?.id.toString() === airportId ||
        f.to?.id.toString() === airportId,
    );
    return flight?.from?.id.toString() === airportId ? flight.from : flight?.to;
  };

  const tempFilterAirport = $derived.by(() => {
    if (tempFilters?.departureAirports.length) {
      return {
        label: 'Departures',
        airport: findAirportById(tempFilters.departureAirports[0]!),
      };
    }
    if (tempFilters?.arrivalAirports.length) {
      return {
        label: 'Arrivals',
        airport: findAirportById(tempFilters.arrivalAirports[0]!),
      };
    }
    if (tempFilters?.airportsEither.length) {
      return {
        label: 'Airport',
        airport: findAirportById(tempFilters.airportsEither[0]!),
      };
    }
    return null;
  });

  const tempFilterRoute = $derived.by(() => {
    if (!tempFilters?.routes.length) return null;
    const route = tempFilters.routes[0]!;
    const flight = flights.find(
      (f) =>
        (f.from?.id.toString() === route.a &&
          f.to?.id.toString() === route.b) ||
        (f.from?.id.toString() === route.b && f.to?.id.toString() === route.a),
    );
    if (!flight?.from || !flight.to) return null;
    return {
      from: flight.from,
      to: flight.to,
    };
  });
</script>

<Modal
  bind:open
  class="md:max-w-full flex flex-col md:h-full md:rounded-none!"
  drawerNoPadding
>
  <div class="max-md:max-h-[calc(100dvh-200px)] max-md:overflow-auto">
    <div class="flex flex-col gap-2 max-md:px-4 max-md:py-4">
      {#if hasTempFilters}
        <div class="flex flex-col gap-1">
          {#if tempFilterAirport?.airport}
            <h3 class="text-sm font-thin text-muted-foreground">
              {tempFilterAirport.label}
            </h3>
            <h2
              class="flex items-center gap-2 text-2xl font-bold tracking-tight"
            >
              <img
                src="https://flagcdn.com/{tempFilterAirport.airport.country.toLowerCase()}.svg"
                alt={tempFilterAirport.airport.country}
                class="h-5 w-8"
              />
              {tempFilterAirport.airport.iata ?? tempFilterAirport.airport.icao}
              <span class="text-base font-normal text-muted-foreground">
                {tempFilterAirport.airport.name}
              </span>
            </h2>
          {:else if tempFilterRoute}
            <h3 class="text-sm font-thin text-muted-foreground">Route</h3>
            <h2
              class="text-2xl font-bold tracking-tight flex items-center gap-2"
            >
              <img
                src="https://flagcdn.com/{tempFilterRoute.from.country.toLowerCase()}.svg"
                alt={tempFilterRoute.from.country}
                class="w-6 h-4"
              />
              {tempFilterRoute.from.iata ?? tempFilterRoute.from.icao}
              <ArrowLeftRight class="text-muted-foreground" />
              <img
                src="https://flagcdn.com/{tempFilterRoute.to.country.toLowerCase()}.svg"
                alt={tempFilterRoute.to.country}
                class="w-6 h-4"
              />
              {tempFilterRoute.to.iata ?? tempFilterRoute.to.icao}
            </h2>
          {/if}
        </div>
      {:else}
        <h2 class="text-3xl font-bold tracking-tight">All Flights</h2>
      {/if}

      {#if filters}
        <Toolbar
          bind:filters
          bind:tempFilters
          bind:flights
          bind:selecting
          bind:selectedFlights
          bind:page
          {flightsPerPage}
          {hasTempFilters}
          numOfFlights={filteredFlights.length}
          modalOpen={open &&
            !addFlightOpen &&
            !mobileEditOpen &&
            !deleteModalOpen}
          onAddFlight={readonly
            ? undefined
            : () => {
                addFlightOpen = true;
              }}
        />
      {/if}
    </div>
    {#if flightsByYear.length === 0}
      <EmptyFlightsState
        {flights}
        {hasTempFilters}
        onShowAllFlights={hasTempFilters ? clearTempFilters : undefined}
        onAddFlight={readonly
          ? undefined
          : () => {
              addFlightOpen = true;
            }}
      />
    {:else if !$isMediumScreen}
      <MobileFlightList
        bind:this={mobileFlightListRef}
        {flightsByYear}
        selecting={readonly ? false : selecting}
        bind:selectedFlights
        onEdit={readonly ? undefined : handleMobileEdit}
        onDelete={readonly ? undefined : handleDelete}
        {readonly}
      />
      <div class="h-[130px] sm:h-[90px]"></div>
    {:else}
      <ScrollArea type="hover">
        <div
          class={cn(
            'hidden gap-y-2 md:grid md:grid-cols-[max-content_32px_minmax(16rem,1fr)_12px_auto] lg:grid-cols-[max-content_12px_minmax(0,12rem)_12px_minmax(16rem,1fr)_12px_auto] xl:grid-cols-[max-content_12px_minmax(0,12rem)_12px_minmax(0,12rem)_12px_minmax(18rem,1fr)_12px_auto]',
            {
              'gap-y-4': showPassengerDetails,
            },
          )}
          use:autoAnimate
        >
          {#each flightsByYear as { year, flights } (year)}
            {#if year !== '0'}
              <LabelledSeparator class="col-span-full mt-4">
                <h3
                  class="border px-4 py-1 rounded-full border-dashed text-sm font-medium leading-7"
                >
                  {year}
                </h3>
              </LabelledSeparator>
            {/if}
            {#each flights as flight (flight.id)}
              <div
                id="flight-list-row-{flight.id}"
                class="relative col-span-full grid grid-cols-subgrid scroll-mt-24 rounded-lg"
              >
                {#if showPassengerDetails && flight.passengers.length}
                  {@render passengerBadge(flight.passengers)}
                {/if}
                <Card
                  onclick={() => {
                    if (!readonly && selecting) {
                      if (selectedFlights.includes(flight.id)) {
                        selectedFlights = selectedFlights.filter(
                          (id) => id !== flight.id,
                        );
                      } else {
                        selectedFlights = [...selectedFlights, flight.id];
                      }
                    }
                  }}
                  level="2"
                  class={cn(
                    'col-span-full grid grid-cols-subgrid items-center p-3',
                    flight.isNextTrip &&
                      'border-l-4 border-l-primary bg-primary/5',
                    {
                      'cursor-pointer border-zinc-600 border-dotted border-2':
                        !readonly && selecting,
                      'border-destructive border-solid':
                        !readonly &&
                        selecting &&
                        selectedFlights.includes(flight.id),
                    },
                  )}
                >
                  {#if flight.hasDateDisplay}
                    <div class="flex min-w-max items-center">
                      <div class="flex w-11 shrink-0 justify-center">
                        <AirlineIcon
                          airline={flight.airline}
                          size={36}
                          fallback="plane"
                        />
                      </div>
                      <Separator orientation="vertical" class="mx-3 h-10" />
                      <div
                        class="flex min-w-max shrink-0 flex-col whitespace-nowrap"
                      >
                        {@render flightTimes(flight)}
                      </div>
                    </div>
                  {:else}
                    <div aria-hidden="true"></div>
                  {/if}
                  <div aria-hidden="true"></div>
                  <div class="hidden min-w-0 flex-col lg:flex">
                    {@render airlineAndDelay(flight)}
                  </div>
                  <div class="hidden lg:block" aria-hidden="true"></div>
                  <div class="hidden min-w-0 flex-col xl:flex">
                    {@render flightAndTailNumber(flight)}
                  </div>
                  <div class="hidden xl:block" aria-hidden="true"></div>
                  <div class="flex min-w-0 px-8 xl:px-12">
                    <div class="w-full grid grid-cols-[auto_1fr_auto] gap-3">
                      {@render airport(flight.from)}
                      <div class="h-full flex flex-col justify-center">
                        <div class="relative">
                          <div
                            class="relative w-full h-px border-b border-dashed border-dark-2 dark:border-zinc-500"
                          >
                            <div
                              class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 px-1 bg-card dark:bg-dark-2 text-dark-2 dark:text-zinc-500"
                            >
                              <div class="flex flex-col items-center">
                                <Plane size="20" />
                                <span class="text-xs">{flight.duration}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      {@render airport(flight.to)}
                    </div>
                  </div>
                  {#if !readonly}
                    <div aria-hidden="true"></div>
                    <div class="hidden md:flex">
                      {@render actions(flight)}
                    </div>
                  {/if}
                </Card>
              </div>
            {/each}
          {/each}
        </div>
        <div class="h-[90px]"></div>
      </ScrollArea>
    {/if}
  </div>

  <!-- Add Flight Modal -->
  <AddFlightModal bind:open={addFlightOpen} />

  <!-- Mobile Edit Modal -->
  {#if mobileEditFlight}
    {#key mobileEditKey}
      <EditFlightModal
        flight={mobileEditFlight}
        bind:open={mobileEditOpen}
        showTrigger={false}
      />
    {/key}
  {/if}

  <!-- Delete Confirmation -->
  <DeleteFlightModal
    bind:open={deleteModalOpen}
    flight={deleteFlightData}
    onConfirm={confirmDelete}
  />
</Modal>

{#snippet flightTimes(flight)}
  <div class="flex items-center" data-testid="flight-time-departure">
    <PlaneTakeoff size="16" class="mr-1" />
    {#if flight.depAt}
      <TimeDisplay
        date={flight.depAt}
        dateStyle="compact"
        airportTz={flight.from?.tz}
        airportLabel={flight.from?.iata}
        side="right"
        class={cn('text-sm', {
          'text-red-600 dark:text-red-400': flight.depStatus === 'late',
        })}
      />
    {:else if flight.depFallback}
      <p class="text-sm">{flight.depFallback}</p>
    {/if}
  </div>
  <div class="flex items-center" data-testid="flight-time-arrival">
    {#if flight.arrAt}
      <PlaneLanding size="16" class="mr-1" />
      <TimeDisplay
        date={flight.arrAt}
        dateStyle="compact"
        airportTz={flight.to?.tz}
        airportLabel={flight.to?.iata}
        side="right"
        class={cn('text-sm overflow-hidden text-ellipsis whitespace-nowrap', {
          'text-green-600 dark:text-green-400': flight.arrStatus === 'early',
          'text-red-600 dark:text-red-400': flight.arrStatus === 'late',
        })}
      />
    {/if}
    <p class="text-sm text-transparent">.</p>
  </div>
{/snippet}

{#snippet airlineAndDelay(flight)}
  {#if flight.airline}
    <Tooltip.AutoTooltip text={flight.airline.name} class="text-sm truncate" />
    {#if flight.depDelayMinutes != null && flight.arrDelayMinutes != null}
      <p class="text-sm text-muted-foreground truncate">
        Dep +{formatDelay(flight.depDelayMinutes)}, Arr +{formatDelay(
          flight.arrDelayMinutes,
        )}
      </p>
    {:else if flight.depDelayMinutes != null}
      <p class="text-sm text-muted-foreground truncate">
        Dep +{formatDelay(flight.depDelayMinutes)}
      </p>
    {:else if flight.arrDelayMinutes != null}
      <p class="text-sm text-muted-foreground truncate">
        Arr +{formatDelay(flight.arrDelayMinutes)}
      </p>
    {:else}
      <p class="text-sm text-transparent">.</p>
    {/if}
  {:else}
    <p class="text-sm text-transparent">.</p>
    <p class="text-sm text-transparent">.</p>
  {/if}
{/snippet}

{#snippet flightAndTailNumber(flight)}
  {@const hasAircraftDetails = flight.aircraft || flight.aircraftReg}
  {#if flight.flightNumber || hasAircraftDetails}
    <Tooltip.AutoTooltip
      text={flight.flightNumber ?? formatAircraft(flight)}
      class="text-sm truncate"
    />
  {:else}
    <p class="text-sm text-transparent">.</p>
  {/if}
  {#if flight.flightNumber && hasAircraftDetails}
    <Tooltip.AutoTooltip
      text={formatAircraft(flight)}
      class="text-sm text-muted-foreground truncate"
    />
  {:else}
    <p class="text-sm text-transparent">.</p>
  {/if}
{/snippet}

{#snippet actions(flight)}
  <div class="flex items-center gap-2">
    {#key flight}
      <EditFlightModal {flight} triggerDisabled={selecting} />
    {/key}
    <Button
      variant="outline"
      size="icon"
      disabled={selecting}
      onclick={() => handleDelete(flight)}
    >
      <X size="24" />
    </Button>
  </div>
{/snippet}

{#snippet passengerBadge(passengers: string[])}
  {@const label =
    passengers.length > 1
      ? `${passengers[0]} +${passengers.length - 1}`
      : passengers[0]}
  {@const needsTooltip = passengers.length > 1}
  <Badge
    variant="secondary"
    class="absolute right-3 -top-2.5 z-10 max-w-32 truncate text-[11px] shadow-sm"
  >
    {#if needsTooltip}
      <Tooltip.Root disableHoverableContent delayDuration={0}>
        <Tooltip.Trigger class="truncate">{label}</Tooltip.Trigger>
        <Tooltip.Content>{passengers.join(', ')}</Tooltip.Content>
      </Tooltip.Root>
    {:else}
      {label}
    {/if}
  </Badge>
{/snippet}

{#snippet airport(airport)}
  <div class="w-11 flex flex-col items-center justify-center">
    <span class="text-lg font-bold">
      {airport?.iata || airport?.icao || 'N/A'}
    </span>
    <Tooltip.AutoTooltip
      text={airport?.name || 'Deleted Airport'}
      class="text-center w-32 text-xs text-muted-foreground truncate"
    />
  </div>
{/snippet}
