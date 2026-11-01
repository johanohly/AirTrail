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
    compact = false,
  }: {
    flight: Flight;
    passengerLabels?: string[];
    showMeta?: boolean;
    compact?: boolean;
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
  <div
    class={[
      '@max-[360px]:mr-2 @max-[300px]:hidden shrink-0 flex items-center justify-center',
      compact ? 'mr-3 w-8' : 'mr-4 w-[50px]',
    ]}
  >
    <AirlineIcon
      airline={flight.airline}
      size={compact ? 28 : 42}
      fallback="plane"
    />
  </div>

  <!-- Content Column -->
  <div class="flex-1 flex justify-between items-start min-w-0">
    <!-- Route Info (Left Side) -->
    <div class={['flex flex-col min-w-0', compact ? 'gap-0.5' : 'gap-1']}>
      <div class="flex items-center gap-2.5 @max-[360px]:gap-1.5">
        {@render airportCode(flight.from)}
        <RouteArrow
          class={compact
            ? 'size-4 shrink-0 fill-foreground'
            : 'size-[22px] shrink-0 fill-foreground @max-[360px]:size-[18px]'}
        />
        {@render airportCode(flight.to)}
      </div>
      <span
        class={[
          'text-muted-foreground truncate',
          compact ? 'text-[13px]' : 'text-[15px]',
        ]}
      >
        {getCityName(flight.from)} to {getCityName(flight.to)}
      </span>
    </div>

    <!-- Meta Info (Right Side) -->
    {#if showMeta}
      <div
        class={[
          'flex flex-col items-end text-right shrink-0 ml-3 @max-[360px]:ml-2',
          compact ? 'gap-0.5' : 'gap-2',
        ]}
      >
        {#if formatDate(flight)}
          <span
            class={[
              'font-semibold text-foreground/90 @max-[360px]:text-sm @max-[360px]:leading-6',
              compact && 'text-[13px]',
            ]}
          >
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
          <span
            class={[
              'text-muted-foreground',
              compact ? 'text-[13px]' : 'text-[15px]',
            ]}
          >
            {getFlightNumber(flight)}
          </span>
        {/if}
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
    <span
      class={[
        'font-extrabold tracking-wide @max-[360px]:tracking-normal',
        compact ? 'text-[15px]' : 'text-xl @max-[360px]:text-lg',
      ]}
    >
      {airport?.iata || airport?.icao || 'N/A'}
    </span>
  </span>
{/snippet}
