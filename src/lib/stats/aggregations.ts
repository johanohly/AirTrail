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

export function visitedCountryStatusDistribution(
  visitedCountries: VisitedCountry[],
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
  visitedCountries: VisitedCountry[],
): Record<string, { visited: number; total: number }> {
  const continentByNumeric = new Map<number, string>();
  const result: Record<string, { visited: number; total: number }> = {};

  for (const country of COUNTRIES) {
    if (country.continent) {
      continentByNumeric.set(country.numeric, country.continent);

      if (!result[country.continent]) {
        result[country.continent] = { visited: 0, total: 0 };
      }
      result[country.continent].total++;
    }
  }

  for (const visitedCountry of visitedCountries) {
    if (wasVisited(visitedCountry)) {
      const continent = continentByNumeric.get(visitedCountry.code);
      if (continent && result[continent]) {
        result[continent].visited++;
      }
    }
  }

  return result;
}

export type CountryDetail = {
  name: string;
  numeric: number;
  visited: boolean;
};

export function countriesByContinentDetails(
  visitedCountries: VisitedCountry[],
): Record<string, CountryDetail[]> {
  const visitedCodes: Set<number> = new Set();
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

    result[country.continent].push({
      name: country.name,
      numeric: country.numeric,
      visited: visitedCodes.has(country.numeric),
    });
  }

  for (const continent in result) {
    result[continent].sort((a, b) => {
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
  const counts = categories.reduce<Record<string, number>>((acc, category) => {
    acc[toTitleCase(category)] = flights.filter((f) =>
      f.seats.some(
        (v) => (v.userId === ctx.userId || !ctx.userId) && v.seat === category,
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

export function seatClassDistribution(
  flights: FlightData[],
  ctx: StatsContext,
  options?: AggregationOptions,
): Record<string, number> {
  const categories = ['economy', 'economy+', 'business', 'first', 'private'];
  const counts = categories.reduce<Record<string, number>>((acc, category) => {
    acc[toTitleCase(category)] = flights.filter((f) =>
      f.seats.some(
        (v) =>
          (v.userId === ctx.userId || !ctx.userId) && v.seatClass === category,
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
  _ctx: StatsContext,
  options?: AggregationOptions,
): Record<string, number> {
  const categories = ['leisure', 'business', 'crew', 'other'];
  const counts = categories.reduce<Record<string, number>>((acc, category) => {
    acc[toTitleCase(category)] = flights.filter(
      (f) => f.flightReason === category,
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
    if (!flight.from || !flight.to) return acc;

    const label =
      (flight.from.iata || flight.from.icao) +
      '-' +
      (flight.to.iata || flight.to.icao);
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
    const label = flight.airline?.name ?? 'No Data';
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
    const label = flight.aircraft?.name ?? 'No Data';
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
    const label = flight.aircraftReg ?? 'No Data';
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
    for (const code of [from?.iata || from?.icao, to?.iata || to?.icao]) {
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
    aggregate: (visitedCountries: VisitedCountry[]) => Record<string, number>;
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
      visitedCountries: VisitedCountry[],
    ) => Record<string, { visited: number; total: number }>;
  }
> = {
  'countries-by-continent': {
    title: 'Countries by Continent',
    aggregate: countriesByContinentDistribution,
  },
};
