<script lang="ts">
  import PieChart from './PieChart.svelte';

  import { page } from '$app/state';
  import { ContinentMap } from '$lib/db/types';
  import { type FlightData, toTitleCase } from '$lib/utils';
  import { aircraftFromICAO } from '$lib/utils/data/aircraft';
  import { airlineFromICAO } from '$lib/utils/data/airlines';

  let { flights }: { flights: FlightData[] } = $props();

  const continents = Object.entries(ContinentMap).map(([code, name]) => ({
    code,
    name,
  }));

  const user = $derived(page.data.user);

  const countByProperty = (
    flights: FlightData[],
    property: keyof FlightData,
    categories: string[],
  ) => {
    return categories.reduce<Record<string, number>>((acc, category) => {
      acc[toTitleCase(category)] = flights.filter(
        (f) => f[property] === category,
      ).length;
      return acc;
    }, {});
  };

  const countBySeatProperty = (
    flights: FlightData[],
    property: keyof FlightData['seats'][0],
    categories: string[],
  ) => {
    return categories.reduce<Record<string, number>>((acc, category) => {
      acc[toTitleCase(category)] = flights.filter((f) =>
        f.seats.some((v) => v.userId === user?.id && v[property] === category),
      ).length;
      return acc;
    }, {});
  };

  const countByContinent = (
    flights: FlightData[],
    continents: { code: string; name: string }[],
  ) => {
    return continents.reduce<Record<string, number>>((acc, continent) => {
      acc[continent.name] = flights.filter(
        (f) => f.to.continent === continent.code,
      ).length;
      return acc;
    }, {});
  };

  const seatDistribution = $derived.by(() => {
    return countBySeatProperty(flights, 'seat', [
      'window',
      'aisle',
      'middle',
      'other',
    ]);
  });
  const seatClassDistribution = $derived.by(() => {
    return countBySeatProperty(flights, 'seatClass', [
      'economy',
      'economy+',
      'business',
      'first',
      'private',
    ]);
  });

  const reasonDistribution = $derived.by(() => {
    return countByProperty(flights, 'flightReason', [
      'leisure',
      'business',
      'crew',
      'other',
    ]);
  });
  const continentDistribution = $derived.by(() => {
    return countByContinent(flights, continents);
  });

  const topRouteDistribution = $derived.by(() => {
    const counts = flights.reduce<Record<string, number>>((acc, flight) => {
      const label =
        (flight.from.iata || flight.from.code) +
        '-' +
        (flight.to.iata || flight.to.code);
      if (label) {
        acc[label] = (acc[label] || 0) + 1;
      }

      return acc;
    }, {});

    return Object.keys(counts).length
      ? Object.fromEntries(
          Object.entries(counts)
            .sort(([, countA], [, countB]) => countB - countA)
            .slice(0, 5),
        )
      : {
          'No flights with route set': 0,
        };
  });

  const topAirlineDistribution = $derived.by(() => {
    const counts = flights.reduce<Record<string, number>>((acc, flight) => {
      if (!flight.airline) return acc;

      const label = airlineFromICAO(flight.airline)?.name;
      if (label) {
        acc[label] = (acc[label] || 0) + 1;
      }

      return acc;
    }, {});

    return Object.keys(counts).length
      ? Object.fromEntries(
          Object.entries(counts)
            .sort(([, countA], [, countB]) => countB - countA)
            .slice(0, 5),
        )
      : {
          'No flights with airline set': 0,
        };
  });

  const topAircraftDistribution = $derived.by(() => {
    const counts = flights.reduce<Record<string, number>>((acc, flight) => {
      if (!flight.aircraft) return acc;

      const label = aircraftFromICAO(flight.aircraft)?.name;
      if (label) {
        acc[label] = (acc[label] || 0) + 1;
      }

      return acc;
    }, {});

    return Object.keys(counts).length
      ? Object.fromEntries(
          Object.entries(counts)
            .sort(([, countA], [, countB]) => countB - countA)
            .slice(0, 5),
        )
      : {
          'No flights with aircraft set': 0,
        };
  });

  const topAircraftRegDistribution = $derived.by(() => {
    const counts = flights.reduce<Record<string, number>>((acc, flight) => {
      if (!flight.aircraftReg) return acc;

      const label = flight.aircraftReg;
      if (label) {
        acc[label] = (acc[label] || 0) + 1;
      }

      return acc;
    }, {});

    return Object.keys(counts).length
      ? Object.fromEntries(
          Object.entries(counts)
            .sort(([, countA], [, countB]) => countB - countA)
            .slice(0, 5),
        )
      : {
          'No flights with aircraft set': 0,
        };
  });
</script>

<div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
  <PieChart data={seatClassDistribution} />
  <PieChart data={seatDistribution} />
  <PieChart data={reasonDistribution} />
  <PieChart data={continentDistribution} />
  <PieChart data={topAirlineDistribution} title="Top Airlines" />
  <PieChart data={topAircraftDistribution} title="Top Aircraft Models" />
  <PieChart data={topAircraftRegDistribution} title="Top Specific Aircrafts" />
  <PieChart data={topRouteDistribution} title="Top Routes" />
</div>
