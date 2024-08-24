<script lang="ts">
  import type { FlightData } from '$lib/utils';
  import PieChart from './PieChart.svelte';

  let { flights }: { flights: FlightData[] } = $props();

  const countByProperty = (flights, property, values) => {
    return values.reduce((acc, value) => {
      acc[value] = flights.filter((f) => f[property] === value).length;
      return acc;
    }, {});
  };

  const countByContinent = (flights, continents) => {
    return continents.reduce((acc, continent) => {
      acc[continent.name] = flights.filter(
        (f) =>
          f.from.continent === continent.code ||
          f.to.continent === continent.code,
      ).length;
      return acc;
    }, {});
  };

  const continents = [
    { code: 'EU', name: 'Europe' },
    { code: 'NA', name: 'North America' },
    { code: 'SA', name: 'South America' },
    { code: 'AS', name: 'Asia' },
    { code: 'AF', name: 'Africa' },
    { code: 'OC', name: 'Oceania' },
  ];

  let seatDistribution = countByProperty(flights, 'seat', [
    'window',
    'aisle',
    'middle',
    'other',
  ]);
  let seatClassDistribution = countByProperty(flights, 'seatClass', [
    'economy',
    'economy+',
    'business',
    'first',
    'private',
  ]);
  let reasonDistribution = countByProperty(flights, 'flightReason', [
    'leisure',
    'business',
    'crew',
    'other',
  ]);
  let continentDistribution = countByContinent(flights, continents);
</script>

<div class="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
  <PieChart data={seatClassDistribution} />
  <PieChart data={seatDistribution} />
  <PieChart data={reasonDistribution} />
  <PieChart data={continentDistribution} />
</div>
