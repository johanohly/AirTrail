import { TZDate } from '@date-fns/tz';
import { isAfter } from 'date-fns';

import { page } from '$app/state';
import type { Airport, Flight, FlightSeat } from '$lib/db/types';
import { distanceBetween, toTitleCase } from '$lib/utils';
import { nowIn, parseLocalISO, parseLocalizeISO } from '$lib/utils/datetime';

type ExcludedType<T, U> = {
  [P in keyof T as P extends keyof U ? never : P]: T[P];
};

type FlightOverrides = {
  date: TZDate | null;
  departure: TZDate | null;
  arrival: TZDate | null;
  distance: number | null;
  raw: Flight;
};
export type FlightData = ExcludedType<Flight, FlightOverrides> &
  FlightOverrides;

export const prepareFlightData = (data: Flight[]): FlightData[] => {
  if (!data) return [];

  return data
    .map((flight) => {
      const departure =
        flight.departure && flight.from
          ? parseLocalizeISO(flight.departure, flight.from.tz)
          : flight.departure
            ? parseLocalizeISO(flight.departure, 'UTC')
            : null;

      return {
        ...flight,
        date:
          departure ??
          (flight.date && flight.from
            ? parseLocalISO(`${flight.date}T00:00`, flight.from.tz)
            : flight.date
              ? parseLocalISO(`${flight.date}T00:00`, 'UTC')
              : null),
        departure,
        arrival:
          flight.arrival && flight.to
            ? parseLocalizeISO(flight.arrival, flight.to.tz)
            : flight.arrival
              ? parseLocalizeISO(flight.arrival, 'UTC')
              : null,
        distance:
          flight.from && flight.to
            ? distanceBetween(
                [flight.from.lon, flight.from.lat],
                [flight.to.lon, flight.to.lat],
              ) / 1000
            : null,
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
      frequency: number;
    };
  } = {};

  data.forEach((flight) => {
    if (!flight.from || !flight.to) return;

    const key = [flight.from.name, flight.to.name]
      .sort((a, b) => a.localeCompare(b))
      .join('-');
    if (!routeMap[key]) {
      routeMap[key] = {
        distance: flight.distance!,
        from: flight.from,
        to: flight.to,
        flights: [],
        airlines: [],
        exclusivelyFuture: false,
        frequency: 1,
      };
    }

    routeMap[key].flights.push(formatSimpleFlight(flight));

    if (
      routeMap[key].flights.every(
        (f) => f.date && isAfter(f.date, nowIn('UTC')),
      )
    ) {
      routeMap[key].exclusivelyFuture = true;
    }

    if (flight.airline) {
      if (!routeMap[key].airlines.includes(flight.airline.id)) {
        routeMap[key].airlines.push(flight.airline.id);
      }
    }
  });

  const routes = Object.values(routeMap);

  const MIN_FREQUENCY = 1;
  const MAX_FREQUENCY = 3;
  const counts = routes.map((r) => r.flights.length);
  const rawMin = counts.length ? Math.min(...counts) : 0;
  const rawMax = counts.length ? Math.max(...counts) : 0;
  const span = rawMax - rawMin || 1;

  routes.forEach((r) => {
    const normalised = (r.flights.length - rawMin) / span;
    r.frequency = normalised * (MAX_FREQUENCY - MIN_FREQUENCY) + MIN_FREQUENCY;
  });

  return routes;
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
    if (!flight[direction]) return;

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
    airports: [f.from?.id, f.to?.id],
    route: `${f.from?.iata ?? f.from?.icao ?? 'N/A'} - ${f.to?.iata ?? f.to?.icao ?? 'N/A'}`,
    date: f.date,
    airline: f.airline ?? '',
  };
};

export const formatSeat = (f: FlightData) => {
  const userId = page.data.user?.id;
  return formatSeatForUser(f, userId);
};

export const formatSeatForUser = (
  f: FlightData,
  userId: string | null | undefined,
) => {
  const t = (s: string) => toTitleCase(s);

  let s;
  if (userId) {
    s = f.seats.find((seat) => seat.userId === userId);
  } else if (f.seats.length === 1) {
    s = f.seats[0];
  }
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

export const getSeatPassengerLabel = (seat: FlightSeat) => {
  return seat.user?.displayName ?? seat.guestName ?? null;
};

export const getSeatPassengerToken = (seat: FlightSeat) => {
  if (seat.userId) {
    return `user:${seat.userId}`;
  }

  if (seat.guestName) {
    return `guest:${seat.guestName}`;
  }

  return null;
};

export const getFlightPassengerLabels = (flight: FlightData) => {
  return flight.seats
    .map((seat) => getSeatPassengerLabel(seat))
    .filter((value): value is string => Boolean(value));
};
