import { TZDate } from '@date-fns/tz';
import { isAfter } from 'date-fns';

import { page } from '$app/state';
import type { Airport, Flight } from '$lib/db/types';
import { distanceBetween, toTitleCase } from '$lib/utils';
import { nowIn, parseLocal, parseLocalizeISO } from '$lib/utils/datetime';

type ExcludedType<T, U> = {
  [P in keyof T as P extends keyof U ? never : P]: T[P];
};

type FlightOverrides = {
  date: TZDate | null;
  departure: TZDate | null;
  arrival: TZDate | null;
  distance: number;
  raw: Flight;
};
export type FlightData = ExcludedType<Flight, FlightOverrides> &
  FlightOverrides;

export const prepareFlightData = (data: Flight[]): FlightData[] => {
  if (!data) return [];

  return data
    .map((flight) => {
      const departure = flight.departure
        ? parseLocalizeISO(flight.departure, flight.from.tz)
        : null;

      return {
        ...flight,
        date:
          departure ??
          (flight.date
            ? parseLocal(flight.date, 'yyyy-MM-dd', flight.from.tz)
            : null),
        departure,
        arrival: flight.arrival
          ? parseLocalizeISO(flight.arrival, flight.to.tz)
          : null,
        distance:
          distanceBetween(
            [flight.from.lon, flight.from.lat],
            [flight.to.lon, flight.to.lat],
          ) / 1000,
        raw: flight,
      };
    })
    .filter((f) => f !== null);
};

export const prepareFlightArcData = (data: FlightData[]) => {
  if (!data) return [];

  const routeMap: {
    [key: string]: {
      distance: number;
      from: Airport;
      to: Airport;
      flights: ReturnType<typeof formatSimpleFlight>[];
      airlines: number[];
      exclusivelyFuture: boolean;
    };
  } = {};

  data.forEach((flight) => {
    const key = [flight.from.name, flight.to.name]
      .sort((a, b) => a.localeCompare(b))
      .join('-');
    if (!routeMap[key]) {
      routeMap[key] = {
        distance: flight.distance,
        from: flight.from,
        to: flight.to,
        flights: [],
        airlines: [],
        exclusivelyFuture: false,
      };
    }

    routeMap[key].flights.push(formatSimpleFlight(flight));

    if (routeMap[key].flights.every((f) => isAfter(f.date, nowIn('UTC')))) {
      routeMap[key].exclusivelyFuture = true;
    }

    if (flight.airline) {
      if (!routeMap[key].airlines.includes(flight.airline.id)) {
        routeMap[key].airlines.push(flight.airline.id);
      }
    }
  });

  return Object.values(routeMap);
};

export const prepareVisitedAirports = (data: FlightData[]) => {
  const visited: (Airport & {
    arrivals: number;
    departures: number;
    airlines: number[];
    flights: ReturnType<typeof formatSimpleFlight>[];
    frequency: number;
  })[] = [];
  const formatAirport = (flight: FlightData, direction: 'from' | 'to') => {
    const airport = flight[direction];
    let visit = visited.find((v) => v.name === airport.name);
    if (!visit) {
      visit = {
        ...airport,
        arrivals: 0,
        departures: 0,
        airlines: [],
        flights: [],
        frequency: 0,
      };
      visited.push(visit);
    }

    if (direction === 'from') {
      visit.departures++;
    } else {
      visit.arrivals++;
    }

    if (flight.airline && !visit.airlines.includes(flight.airline.id)) {
      visit.airlines.push(flight.airline.id);
    }

    visit.flights.push(formatSimpleFlight(flight));
  };

  data.forEach((flight) => {
    formatAirport(flight, 'from');
    formatAirport(flight, 'to');
  });

  const MIN_FREQUENCY = 1;
  const MAX_FREQUENCY = 3;

  const combinedFrequencies = visited.map((v) => v.arrivals + v.departures);

  const rawMin = Math.min(...combinedFrequencies);
  const rawMax = Math.max(...combinedFrequencies);

  const span = rawMax - rawMin || 1;

  visited.forEach((v) => {
    const combined = v.arrivals + v.departures;

    const normalised = (combined - rawMin) / span;

    v.frequency = normalised * (MAX_FREQUENCY - MIN_FREQUENCY) + MIN_FREQUENCY;
  });

  return visited;
};

const formatSimpleFlight = (f: FlightData) => {
  return {
    airports: [f.from.id, f.to.id],
    route: `${f.from.iata ?? f.from.icao} - ${f.to.iata ?? f.to.icao}`,
    date: f.date,
    airline: f.airline ?? '',
  };
};

export const formatSeat = (f: FlightData) => {
  const t = (s: string) => toTitleCase(s);

  const userId = page.data.user?.id;
  if (!userId) return null;

  const s = f.seats.find((seat) => seat.userId === userId);
  if (!s) return null;

  if (s.seat && s.seatNumber && s.seatClass) {
    return `${t(s.seatClass)} (${s.seat} ${s.seatNumber})`;
  }
  if (s.seat && s.seatNumber) {
    return `${s.seat} ${s.seatNumber}`;
  }
  if (s.seat && s.seatClass) {
    return `${t(s.seatClass)} (${s.seat})`;
  }
  if (s.seatClass) {
    return t(s.seatClass);
  }
  if (s.seat) {
    return t(s.seat);
  }
  return null;
};
