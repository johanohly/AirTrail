import { ContinentMap } from '$lib/db/types';
import { type FlightData, toTitleCase } from '$lib/utils';

export type ChartKey =
  | 'seat-class'
  | 'seat'
  | 'reason'
  | 'continents'
  | 'airlines'
  | 'aircraft-models'
  | 'aircraft-regs'
  | 'airports'
  | 'routes';

export type StatsContext = {
  // If omitted, aggregate for all users
  userId?: string;
};

export type AggregationOptions = {
  limit?: number; // if provided, return top N
};

function sortAndLimit(
  counts: Record<string, number>,
  options?: AggregationOptions,
): Record<string, number> {
  const entries = Object.entries(counts).sort(([, a], [, b]) => b - a);
  const limited = options?.limit ? entries.slice(0, options.limit) : entries;
  return Object.fromEntries(limited);
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
    if (!flight.airline) return acc;
    const label = flight.airline?.name;
    if (label) acc[label] = (acc[label] || 0) + 1;
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
    if (!flight.aircraft) return acc;
    const label = flight.aircraft?.name;
    if (label) acc[label] = (acc[label] || 0) + 1;
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
    if (!flight.aircraftReg) return acc;
    const label = flight.aircraftReg;
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

export const CHARTS: Record<
  ChartKey,
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
