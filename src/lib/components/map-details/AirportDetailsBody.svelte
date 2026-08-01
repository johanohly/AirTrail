<script lang="ts">
  import AirportFlightsCard from '$lib/components/airport-details/AirportFlightsCard.svelte';
  import AirportStatsCard from '$lib/components/airport-details/AirportStatsCard.svelte';
  import AirportTimeCard from '$lib/components/airport-details/AirportTimeCard.svelte';
  import AirportWeatherCard from '$lib/components/airport-details/AirportWeatherCard.svelte';
  import type { FlightData, prepareVisitedAirports } from '$lib/utils';

  type VisitedAirport = ReturnType<typeof prepareVisitedAirports>[number];

  let {
    airport,
    relatedFlights,
    onShowDepartures,
    onShowArrivals,
    onShowFlight,
  }: {
    airport: VisitedAirport;
    relatedFlights: FlightData[];
    onShowDepartures: () => void;
    onShowArrivals: () => void;
    onShowFlight: (flightId: number) => void;
  } = $props();

  let now = $state(new Date());
  $effect(() => {
    const id = setInterval(() => (now = new Date()), 30_000);
    return () => clearInterval(id);
  });
</script>

<AirportStatsCard
  flights={relatedFlights}
  airportId={airport.id}
  airlineCount={airport.airlines.length}
  {now}
/>
<AirportTimeCard tz={airport.tz} {now} />
<AirportWeatherCard icao={airport.icao} tz={airport.tz} lon={airport.lon} />
<AirportFlightsCard
  flights={relatedFlights}
  airportId={airport.id}
  onShowAllDepartures={onShowDepartures}
  onShowAllArrivals={onShowArrivals}
  {onShowFlight}
/>
