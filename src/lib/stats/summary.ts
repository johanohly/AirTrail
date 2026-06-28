import { isBefore } from 'date-fns';

import type { Flight } from '$lib/db/types';
import { distanceBetween } from '$lib/utils';
import {
  getFlightDateRange,
  nowIn,
  parseLocalizeISO,
} from '$lib/utils/datetime';

type TopKeyResult = {
  best: string | null;
  count: number;
};

export type FlightStatsSummary = {
  flights: number;
  distanceKm: number;
  durationSeconds: number;
  airports: number;
  topAirline: {
    id: number;
    name: string;
    iata: string | null;
    icao: string | null;
    count: number;
  } | null;
  topAirport: {
    id: number;
    name: string;
    icao: string;
    iata: string | null;
    count: number;
  } | null;
  topAircraft: {
    id: number;
    name: string;
    icao: string | null;
    count: number;
  } | null;
  topRoute: {
    from: {
      id: number;
      name: string;
      icao: string;
      iata: string | null;
    };
    to: {
      id: number;
      name: string;
      icao: string;
      iata: string | null;
    };
    count: number;
  } | null;
};

const topKey = (
  flights: Flight[],
  getKey: (flight: Flight) => string | null,
): TopKeyResult => {
  const counts = new Map<string, number>();
  for (const flight of flights) {
    const key = getKey(flight);
    if (key !== null) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let best: string | null = null;
  let count = 0;
  for (const [key, currentCount] of counts) {
    if (currentCount > count) {
      best = key;
      count = currentCount;
    }
  }

  return { best, count };
};

export const isCompletedFlight = (flight: Flight): boolean => {
  if (!flight.date) return true;

  const hasExactDateTime = flight.datePrecision === 'day';
  const arrival =
    hasExactDateTime && flight.arrival
      ? parseLocalizeISO(flight.arrival, flight.to?.tz ?? 'UTC')
      : null;
  const { start, end } = getFlightDateRange(
    flight.date,
    flight.datePrecision,
    flight.from?.tz ?? 'UTC',
  );

  const fallbackDate = flight.datePrecision === 'day' ? start : (end ?? start);
  const comparisonDate = arrival ?? fallbackDate;
  if (!comparisonDate) return true;

  return isBefore(comparisonDate, nowIn(flight.to?.tz ?? 'UTC'));
};

export const completedFlights = (flights: Flight[]): Flight[] =>
  flights.filter(isCompletedFlight);

export const computeFlightStatsSummary = (
  flights: Flight[],
): FlightStatsSummary => {
  let totalDistanceKm = 0;
  let totalDurationSeconds = 0;
  const airportIds = new Set<string>();

  for (const flight of flights) {
    if (flight.from && flight.to) {
      totalDistanceKm +=
        distanceBetween(
          [flight.from.lon, flight.from.lat],
          [flight.to.lon, flight.to.lat],
        ) / 1000;
    }

    if (flight.duration !== null) {
      totalDurationSeconds += flight.duration;
    }

    if (flight.from?.id) airportIds.add(String(flight.from.id));
    if (flight.to?.id) airportIds.add(String(flight.to.id));
  }

  const airlineResult = topKey(flights, (flight) =>
    flight.airline ? String(flight.airline.id) : null,
  );
  const topAirline = airlineResult.best
    ? (() => {
        const airline = flights.find(
          (flight) => String(flight.airline?.id) === airlineResult.best,
        )!.airline!;
        return {
          id: airline.id,
          name: airline.name,
          iata: airline.iata,
          icao: airline.icao,
          count: airlineResult.count,
        };
      })()
    : null;

  const airportCounts = new Map<string, number>();
  for (const flight of flights) {
    if (flight.from?.id) {
      airportCounts.set(
        String(flight.from.id),
        (airportCounts.get(String(flight.from.id)) ?? 0) + 1,
      );
    }
    if (flight.to?.id) {
      airportCounts.set(
        String(flight.to.id),
        (airportCounts.get(String(flight.to.id)) ?? 0) + 1,
      );
    }
  }

  let bestAirportId: string | null = null;
  let bestAirportCount = 0;
  for (const [id, count] of airportCounts) {
    if (count > bestAirportCount) {
      bestAirportId = id;
      bestAirportCount = count;
    }
  }
  const topAirport = bestAirportId
    ? (() => {
        const flight = flights.find(
          (flight) =>
            String(flight.from?.id) === bestAirportId ||
            String(flight.to?.id) === bestAirportId,
        )!;
        const airport =
          String(flight.from?.id) === bestAirportId ? flight.from! : flight.to!;
        return {
          id: airport.id,
          name: airport.name,
          icao: airport.icao,
          iata: airport.iata,
          count: bestAirportCount,
        };
      })()
    : null;

  const aircraftResult = topKey(flights, (flight) =>
    flight.aircraft ? String(flight.aircraft.id) : null,
  );
  const topAircraft = aircraftResult.best
    ? (() => {
        const aircraft = flights.find(
          (flight) => String(flight.aircraft?.id) === aircraftResult.best,
        )!.aircraft!;
        return {
          id: aircraft.id,
          name: aircraft.name,
          icao: aircraft.icao,
          count: aircraftResult.count,
        };
      })()
    : null;

  const routeResult = topKey(flights, (flight) =>
    flight.from && flight.to ? `${flight.from.id}|${flight.to.id}` : null,
  );
  const topRoute = routeResult.best
    ? (() => {
        const flight = flights.find(
          (flight) =>
            flight.from &&
            flight.to &&
            `${flight.from.id}|${flight.to.id}` === routeResult.best,
        )!;
        return {
          from: {
            id: flight.from!.id,
            name: flight.from!.name,
            icao: flight.from!.icao,
            iata: flight.from!.iata,
          },
          to: {
            id: flight.to!.id,
            name: flight.to!.name,
            icao: flight.to!.icao,
            iata: flight.to!.iata,
          },
          count: routeResult.count,
        };
      })()
    : null;

  return {
    flights: flights.length,
    distanceKm: Math.round(totalDistanceKm),
    durationSeconds: totalDurationSeconds,
    airports: airportIds.size,
    topAirline,
    topAirport,
    topAircraft,
    topRoute,
  };
};

export const computeCompletedFlightStatsSummary = (
  flights: Flight[],
): FlightStatsSummary => computeFlightStatsSummary(completedFlights(flights));
