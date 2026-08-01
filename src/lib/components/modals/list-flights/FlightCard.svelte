<script lang="ts">
  import type { TZDate } from '@date-fns/tz';

  import { page } from '$app/state';
  import { AirlineIcon, RouteArrow } from '$lib/components/display';
  import { Badge } from '$lib/components/ui/badge';
  import type { Airline, Airport, FlightDatePrecision } from '$lib/db/types';
  import { formatFlightDate, getPreferences } from '$lib/utils/preferences';

  type Flight = {
    from: Airport | null;
    to: Airport | null;
    airline: Airline | null;
    flightNumber?: string | null;
    date?: TZDate | null;
    datePrecision?: FlightDatePrecision;
  };

  let {
    flight,
    passengerLabels = [],
    showMeta = true,
  }: {
    flight: Flight;
    passengerLabels?: string[];
    showMeta?: boolean;
  } = $props();

  const prefs = $derived(getPreferences(page.data.user));

  const formatDate = (flight: Flight) => {
    if (!flight.date) return null;
    return formatFlightDate(flight.date, flight.datePrecision ?? 'day', prefs);
  };

  const getFlightNumber = (flight: Flight) => {
    if (!flight.flightNumber) return null;
    return flight.flightNumber.replace(/([a-zA-Z]{2})(\d+)/, '$1 $2');
  };

  const getCityName = (airport: Airport | null) => {
    if (!airport) return 'Unknown';
    return airport.municipality || airport.name;
  };
</script>

<div class="flex w-full text-left">
  <!-- Logo Column -->
  <div class="w-[50px] mr-4 shrink-0 flex items-center justify-center">
    <AirlineIcon airline={flight.airline} size={42} fallback="plane" />
  </div>

  <!-- Content Column -->
  <div class="flex-1 flex justify-between items-start min-w-0">
    <!-- Route Info (Left Side) -->
    <div class="flex flex-col gap-1 min-w-0">
      <div class="flex items-center gap-2.5">
        <span class="text-xl font-extrabold tracking-wide">
          {flight.from?.iata || flight.from?.icao || 'N/A'}
        </span>
        <RouteArrow class="size-[22px] fill-foreground" />
        <span class="text-xl font-extrabold tracking-wide">
          {flight.to?.iata || flight.to?.icao || 'N/A'}
        </span>
      </div>
      <span class="text-[15px] text-muted-foreground truncate">
        {getCityName(flight.from)} to {getCityName(flight.to)}
      </span>
    </div>

    <!-- Meta Info (Right Side) -->
    {#if showMeta}
      <div class="flex flex-col items-end gap-2 text-right shrink-0 ml-3">
        {#if formatDate(flight)}
          <span class="font-semibold text-foreground/90">
            {formatDate(flight)}
          </span>
        {/if}
        {#if passengerLabels.length}
          <Badge variant="outline" class="max-w-[120px] truncate self-end">
            {passengerLabels[0]}{passengerLabels.length > 1
              ? ` +${passengerLabels.length - 1}`
              : ''}
          </Badge>
        {:else if getFlightNumber(flight)}
          <span class="text-[15px] text-muted-foreground">
            {getFlightNumber(flight)}
          </span>
        {/if}
      </div>
    {/if}
  </div>
</div>
