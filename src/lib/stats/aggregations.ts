import {
  ContinentMap,
  type VisitedCountry,
  VisitedCountryStatus,
  wasVisited,
} from '$lib/db/types';
import { COUNTRIES } from '$lib/data/countries';
import { type FlightData, toTitleCase } from '$lib/utils';

export type FlightChartKey =
  | 'seat-class'
  | 'seat'
  | 'reason'
  | 'continents'
  | 'airlines'
  | 'aircraft-models'
  | 'aircraft-regs'
  | 'airports'
  | 'routes';

export type CountryChartKey = 'visited-country-status';

export type CountryBarChartKey = 'countries-by-continent';

export type ChartKey = FlightChartKey | CountryChartKey | CountryBarChartKey;

export type StatsContext = {
  // If omitted, aggregate for all users
  userId?: string;
};

export type AggregationOptions = {
  limit?: number; // if provided, return top N
};

export type VisitedCountryStats = Pick<
  VisitedCountry,
  'code' | 'status' | 'note'
>;

export function visitedCountryStatusDistribution(
  visitedCountries: VisitedCountryStats[],
): Record<string, number> {
  const counts = VisitedCountryStatus.reduce<Record<string, number>>(
    (acc, status) => {
      acc[toTitleCase(status)] = visitedCountries.filter(
        (c) => c.status === status,
      ).length;
      return acc;
    },
    {},
  );
  return counts;
}

export function countriesByContinentDistribution(
  visitedCountries: VisitedCountryStats[],
): Record<string, { visited: number; total: number }> {
  const continentByCode = new Map<string, string>();
  const result: Record<string, { visited: number; total: number }> = {};

  for (const country of COUNTRIES) {
    if (country.continent) {
      continentByCode.set(country.alpha2, country.continent);

      if (!result[country.continent]) {
        result[country.continent] = { visited: 0, total: 0 };
      }
      result[country.continent]!.total++;
    }
  }

  for (const visitedCountry of visitedCountries) {
    if (wasVisited(visitedCountry)) {
      const continent = continentByCode.get(visitedCountry.code);
      if (continent && result[continent]) {
        result[continent].visited++;
      }
    }
  }

  return result;
}

export type CountryDetail = {
  name: string;
  code: string;
  visited: boolean;
};

export function countriesByContinentDetails(
  visitedCountries: VisitedCountryStats[],
): Record<string, CountryDetail[]> {
  const visitedCodes: Set<string> = new Set();
  for (const country of visitedCountries) {
    if (wasVisited(country)) {
      visitedCodes.add(country.code);
    }
  }

  const result: Record<string, CountryDetail[]> = {};

  for (const country of COUNTRIES) {
    if (!country.continent) continue;

    if (!result[country.continent]) {
      result[country.continent] = [];
    }

    result[country.continent]!.push({
      name: country.name,
      code: country.alpha2,
      visited: visitedCodes.has(country.alpha2),
    });
  }

  for (const continent in result) {
    result[continent]!.sort((a, b) => {
      if (a.visited !== b.visited) {
        return a.visited ? -1 : 1; // visited first
      }
      return a.name.localeCompare(b.name); // alphabetically
    });
  }

  return result;
}

function sortAndLimit(
  counts: Record<string, number>,
  options?: AggregationOptions,
): Record<string, number> {
  const entries = Object.entries(counts).sort(([, a], [, b]) => b - a);
  if (!options?.limit || entries.length <= options.limit) {
    return Object.fromEntries(entries);
  }

  const top = entries.slice(0, options.limit);
  const others = entries
    .slice(options.limit)
    .reduce((acc, [, count]) => acc + count, 0);

  if (others > 0) {
    top.push(['Others', others]);
  }

  return Object.fromEntries(top);
}

export const codeForAirport = (
  airport: FlightData['from'] | null | undefined,
) => airport?.iata || airport?.icao || null;

export const routeLabelForFlight = (flight: FlightData): string | null => {
  const fromCode = codeForAirport(flight.from);
  const toCode = codeForAirport(flight.to);
  if (!fromCode || !toCode) return null;
  return `${fromCode}-${toCode}`;
};

export const flightChartBucketForFlight = (
  flight: FlightData,
  key: Exclude<FlightChartKey, 'seat' | 'seat-class' | 'airports'>,
): string | null => {
  switch (key) {
    case 'airlines':
      return flight.airline?.name ?? 'No Data';
    case 'aircraft-models':
      return flight.aircraft?.name ?? 'No Data';
    case 'aircraft-regs':
      return flight.aircraftReg ?? 'No Data';
    case 'reason':
      return null;
    case 'continents':
      return flight.to?.continent
        ? ContinentMap[flight.to.continent]
        : 'No Data';
    case 'routes':
      return routeLabelForFlight(flight);
  }
};

export const flightMatchesChartBucket = (
  flight: FlightData,
  chartKey: FlightChartKey,
  bucket: string,
  ctx: StatsContext = {},
): boolean => {
  if (bucket === 'Others') return false;

  if (
    chartKey === 'seat' ||
    chartKey === 'seat-class' ||
    chartKey === 'reason'
  ) {
    const field =
      chartKey === 'seat'
        ? 'seat'
        : chartKey === 'seat-class'
          ? 'seatClass'
          : 'flightReason';
    const passengers = ctx.userId
      ? flight.passengers.filter((passenger) => passenger.userId === ctx.userId)
      : flight.passengers;

    if (bucket === 'No Data') {
      if (ctx.userId) {
        return (
          passengers.length === 0 ||
          passengers.some((passenger) => !passenger[field])
        );
      }
      return passengers.some((passenger) => !passenger[field]);
    }

    return passengers.some(
      (seat) => seat[field] && toTitleCase(seat[field]) === bucket,
    );
  }

  if (chartKey === 'airports') {
    return (
      codeForAirport(flight.from) === bucket ||
      codeForAirport(flight.to) === bucket
    );
  }

  return flightChartBucketForFlight(flight, chartKey) === bucket;
};

export function seatDistribution(
  flights: FlightData[],
  ctx: StatsContext,
  options?: AggregationOptions,
): Record<string, number> {
  const categories = [
    'window',
    'aisle',
    'middle',
    'pilot',
    'copilot',
    'jumpseat',
    'other',
  ];

  if (!ctx.userId) {
    const passengers = flights.flatMap((flight) => flight.passengers);
    const counts = categories.reduce<Record<string, number>>(
      (acc, category) => {
        acc[toTitleCase(category)] = passengers.filter(
          (seat) => seat.seat === category,
        ).length;
        return acc;
      },
      {},
    );

    const totalClassified = Object.values(counts).reduce((a, b) => a + b, 0);
    const noData = passengers.length - totalClassified;
    if (noData > 0) {
      counts['No Data'] = noData;
    }

    return sortAndLimit(counts, options);
  }

  const counts = categories.reduce<Record<string, number>>((acc, category) => {
    acc[toTitleCase(category)] = flights.filter((f) =>
      f.passengers.some((v) => v.userId === ctx.userId && v.seat === category),
    ).length;
    return acc;
  }, {});

  const totalClassified = Object.values(counts).reduce((a, b) => a + b, 0);
  const noData = flights.length - totalClassified;
  if (noData > 0) {
    counts['No Data'] = noData;
  }

  return sortAndLimit(counts, options);
}

export function seatClassDistribution(
  flights: FlightData[],
  ctx: StatsContext,
  options?: AggregationOptions,
): Record<string, number> {
  const categories = ['economy', 'economy+', 'business', 'first', 'private'];

  if (!ctx.userId) {
    const passengers = flights.flatMap((flight) => flight.passengers);
    const counts = categories.reduce<Record<string, number>>(
      (acc, category) => {
        acc[toTitleCase(category)] = passengers.filter(
          (seat) => seat.seatClass === category,
        ).length;
        return acc;
      },
      {},
    );

    const totalClassified = Object.values(counts).reduce((a, b) => a + b, 0);
    const noData = passengers.length - totalClassified;
    if (noData > 0) {
      counts['No Data'] = noData;
    }

    return sortAndLimit(counts, options);
  }

  const counts = categories.reduce<Record<string, number>>((acc, category) => {
    acc[toTitleCase(category)] = flights.filter((f) =>
      f.passengers.some(
        (v) => v.userId === ctx.userId && v.seatClass === category,
      ),
    ).length;
    return acc;
  }, {});

  const totalClassified = Object.values(counts).reduce((a, b) => a + b, 0);
  const noData = flights.length - totalClassified;
  if (noData > 0) {
    counts['No Data'] = noData;
  }

  return sortAndLimit(counts, options);
}

export function reasonDistribution(
  flights: FlightData[],
  ctx: StatsContext,
  options?: AggregationOptions,
): Record<string, number> {
  const categories = ['leisure', 'business', 'crew', 'other'];

  if (!ctx.userId) {
    const passengers = flights.flatMap((flight) => flight.passengers);
    const counts = categories.reduce<Record<string, number>>(
      (acc, category) => {
        acc[toTitleCase(category)] = passengers.filter(
          (passenger) => passenger.flightReason === category,
        ).length;
        return acc;
      },
      {},
    );
    const totalClassified = Object.values(counts).reduce((a, b) => a + b, 0);
    const noData = passengers.length - totalClassified;
    if (noData > 0) counts['No Data'] = noData;
    return sortAndLimit(counts, options);
  }

  const counts = categories.reduce<Record<string, number>>((acc, category) => {
    acc[toTitleCase(category)] = flights.filter((flight) =>
      flight.passengers.some(
        (passenger) =>
          passenger.userId === ctx.userId &&
          passenger.flightReason === category,
      ),
    ).length;
    return acc;
  }, {});

  const totalClassified = Object.values(counts).reduce((a, b) => a + b, 0);
  const noData = flights.length - totalClassified;
  if (noData > 0) {
    counts['No Data'] = noData;
  }

  return sortAndLimit(counts, options);
}

export function continentDistribution(
  flights: FlightData[],
  _ctx: StatsContext,
  options?: AggregationOptions,
): Record<string, number> {
  const continents = Object.entries(ContinentMap).map(([code, name]) => ({
    code,
    name,
  }));
  const counts = continents.reduce<Record<string, number>>((acc, continent) => {
    acc[continent.name] = flights.filter(
      (f) => f.to && f.to.continent === continent.code,
    ).length;
    return acc;
  }, {});

  const totalClassified = Object.values(counts).reduce((a, b) => a + b, 0);
  const noData = flights.length - totalClassified;
  if (noData > 0) {
    counts['No Data'] = noData;
  }

  return sortAndLimit(counts, options);
}

export function routeDistribution(
  flights: FlightData[],
  _ctx: StatsContext,
  options?: AggregationOptions,
): Record<string, number> {
  const counts = flights.reduce<Record<string, number>>((acc, flight) => {
    const label = routeLabelForFlight(flight);
    if (!label) return acc;

    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
  return sortAndLimit(counts, options);
}

export function airlineDistribution(
  flights: FlightData[],
  _ctx: StatsContext,
  options?: AggregationOptions,
): Record<string, number> {
  const counts = flights.reduce<Record<string, number>>((acc, flight) => {
    const label = flightChartBucketForFlight(flight, 'airlines') ?? 'No Data';
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
  return sortAndLimit(counts, options);
}

export function aircraftModelDistribution(
  flights: FlightData[],
  _ctx: StatsContext,
  options?: AggregationOptions,
): Record<string, number> {
  const counts = flights.reduce<Record<string, number>>((acc, flight) => {
    const label =
      flightChartBucketForFlight(flight, 'aircraft-models') ?? 'No Data';
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
  return sortAndLimit(counts, options);
}

export function aircraftRegDistribution(
  flights: FlightData[],
  _ctx: StatsContext,
  options?: AggregationOptions,
): Record<string, number> {
  const counts = flights.reduce<Record<string, number>>((acc, flight) => {
    const label =
      flightChartBucketForFlight(flight, 'aircraft-regs') ?? 'No Data';
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
  return sortAndLimit(counts, options);
}

export function airportDistribution(
  flights: FlightData[],
  _ctx: StatsContext,
  options?: AggregationOptions,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const { from, to } of flights) {
    for (const code of [codeForAirport(from), codeForAirport(to)]) {
      if (!code) continue;

      counts[code] = (counts[code] ?? 0) + 1;
    }
  }
  return sortAndLimit(counts, options);
}

export const FLIGHT_CHARTS: Record<
  FlightChartKey,
  {
    title: string;
    aggregate: (
      flights: FlightData[],
      ctx: StatsContext,
      options?: AggregationOptions,
    ) => Record<string, number>;
  }
> = {
  'seat-class': { title: 'Seat Class', aggregate: seatClassDistribution },
  seat: { title: 'Seat Preference', aggregate: seatDistribution },
  reason: { title: 'Flight Reasons', aggregate: reasonDistribution },
  continents: { title: 'Continents', aggregate: continentDistribution },
  airlines: { title: 'Airlines', aggregate: airlineDistribution },
  'aircraft-models': {
    title: 'Aircraft Models',
    aggregate: aircraftModelDistribution,
  },
  'aircraft-regs': {
    title: 'Specific Aircrafts',
    aggregate: aircraftRegDistribution,
  },
  airports: { title: 'Visited Airports', aggregate: airportDistribution },
  routes: { title: 'Routes', aggregate: routeDistribution },
};

export const COUNTRY_CHARTS: Record<
  CountryChartKey,
  {
    title: string;
    aggregate: (
      visitedCountries: VisitedCountryStats[],
    ) => Record<string, number>;
  }
> = {
  'visited-country-status': {
    title: 'Visited Country Status',
    aggregate: visitedCountryStatusDistribution,
  },
};

export const COUNTRY_BAR_CHARTS: Record<
  CountryBarChartKey,
  {
    title: string;
    aggregate: (
      visitedCountries: VisitedCountryStats[],
    ) => Record<string, { visited: number; total: number }>;
  }
> = {
  'countries-by-continent': {
    title: 'Countries by Continent',
    aggregate: countriesByContinentDistribution,
  },
};
