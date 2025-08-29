<script lang="ts">
  import NumberFlow from '@number-flow/svelte';

  import { page } from '$app/state';
  import { kmToMiles, pluralize } from '$lib/utils';
  import { formatAsDate } from '$lib/utils/datetime';

  const metric = $derived(page.data.user?.unit === 'metric');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data }: { data: any } = $props();
</script>

<div class="flex flex-col px-3 pt-3">
  <h3 class="font-thin text-muted-foreground">Route</h3>
  <h4 class="flex items-center text-lg">
    <img
      src="https://flagcdn.com/{data.from.country.toLowerCase()}.svg"
      alt={data.from.country}
      class="w-8 h-5 mr-2"
    />
    {data.from.iata ?? data.from.icao} - {data.from.name}
  </h4>
  <h4 class="flex items-center text-lg">
    <img
      src="https://flagcdn.com/{data.to.country.toLowerCase()}.svg"
      alt={data.to.country}
      class="w-8 h-5 mr-2"
    />
    {data.to.iata ?? data.to.icao} - {data.to.name}
  </h4>
</div>
<div class="h-px bg-muted my-3" />
<div class="grid grid-cols-[repeat(3,1fr)] px-3">
  <h4 class="font-semibold">
    <NumberFlow
      value={Math.round(metric ? data.distance : kmToMiles(data.distance))}
    />
    <span class="font-thin text-muted-foreground">{metric ? 'km' : 'mi'}</span>
  </h4>
  <h4 class="font-semibold">
    <NumberFlow value={data.flights.length} />
    <span class="font-thin text-muted-foreground"
      >{pluralize(data.flights.length, 'trip')}</span
    >
  </h4>
  <h4 class="font-semibold">
    <NumberFlow value={data.airlines.length} />
    <span class="font-thin text-muted-foreground"
      >{pluralize(data.airlines.length, 'airline')}</span
    >
  </h4>
</div>
<div class="h-px bg-muted my-3" />
<div class="px-3 pb-3">
  <div class="grid grid-cols-[repeat(3,1fr)]">
    <h3 class="font-semibold">Route</h3>
    <h3 class="font-semibold">Date</h3>
    <h3 class="font-semibold">Airline</h3>
  </div>
  {#each data.flights
    .slice(0, 5)
    .sort( (a, b) => (a.date && b.date ? b.date.getTime() - a.date.getTime() : 0), ) as flight}
    <div class="grid grid-cols-[repeat(3,1fr)]">
      <h4 class="font-thin">{flight.route}</h4>
      <h4 class="font-thin">
        {flight.date ? formatAsDate(flight.date, true, true) : ''}
      </h4>
      <h4 class="font-thin">{flight.airline.name}</h4>
    </div>
  {/each}
  {#if data.flights.length > 5}
    <h4 class="font-thin text-muted-foreground">
      +{data.flights.length - 5} more
    </h4>
  {/if}
</div>
