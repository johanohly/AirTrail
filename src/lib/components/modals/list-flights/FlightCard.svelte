<script lang="ts">
  import type { TZDate } from '@date-fns/tz';
  import type { Snippet } from 'svelte';

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
    indicators,
  }: {
    flight: Flight;
    passengerLabels?: string[];
    showMeta?: boolean;
    indicators?: Snippet;
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

<div class="@container flex w-full text-left">
  <!-- Logo Column -->
  <div class="w-[50px] mr-4 shrink-0 flex items-center justify-center">
    <AirlineIcon airline={flight.airline} size={42} fallback="plane" />
  </div>

  <!-- Content Column -->
  <div class="flex-1 flex justify-between items-start min-w-0">
    <!-- Route Info (Left Side) -->
    <div class="flex flex-col gap-1 min-w-0">
      <div class="flex items-center gap-2.5">
        {@render airportCode(flight.from)}
        <RouteArrow class="size-[22px] fill-foreground" />
        {@render airportCode(flight.to)}
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
        {@render indicators?.()}
      </div>
    {/if}
  </div>
</div>

{#snippet airportCode(airport: Airport | null)}
  <span class="flex items-center gap-1.5">
    {#if airport}
      <img
        src="https://flagcdn.com/{airport.country.toLowerCase()}.svg"
        alt={airport.country}
        class="hidden h-4 w-6 shrink-0 rounded object-cover shadow-sm @min-[416px]:block"
      />
    {/if}
    <span class="text-xl font-extrabold tracking-wide">
      {airport?.iata || airport?.icao || 'N/A'}
    </span>
  </span>
{/snippet}
