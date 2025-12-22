<script lang="ts">
  import type { TZDate } from '@date-fns/tz';

  import AirlineIcon from '$lib/components/display/AirlineIcon.svelte';
  import type { Airline, Airport } from '$lib/db/types';
  import { formatAsDate } from '$lib/utils/datetime';

  type Flight = {
    from: Airport | null;
    to: Airport | null;
    airline: Airline | null;
    flightNumber?: string | null;
    date?: TZDate | null;
  };

  let {
    flight,
    showMeta = true,
  }: {
    flight: Flight;
    showMeta?: boolean;
  } = $props();

  const formatDate = (flight: Flight) => {
    if (!flight.date) return null;
    return formatAsDate(flight.date, false, true);
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
        <div
          class="fill-foreground size-[22px] flex items-center justify-center shrink-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"
            ><path
              d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM361 417C351.6 426.4 336.4 426.4 327.1 417C317.8 407.6 317.7 392.4 327.1 383.1L366.1 344.1L216 344.1C202.7 344.1 192 333.4 192 320.1C192 306.8 202.7 296.1 216 296.1L366.1 296.1L327.1 257.1C317.7 247.7 317.7 232.5 327.1 223.2C336.5 213.9 351.7 213.8 361 223.2L441 303.2C450.4 312.6 450.4 327.8 441 337.1L361 417.1z"
            /></svg
          >
        </div>
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
        {#if getFlightNumber(flight)}
          <span class="text-[15px] text-muted-foreground">
            {getFlightNumber(flight)}
          </span>
        {:else if flight.airline}
          <span class="text-sm text-muted-foreground truncate max-w-[120px]">
            {flight.airline.name}
          </span>
        {/if}
      </div>
    {/if}
  </div>
</div>
