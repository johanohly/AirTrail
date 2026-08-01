import { TZDate } from '@date-fns/tz';
import { isAfter } from 'date-fns';

import { resolveFlightTimeline } from './flight-timeline';

import { page } from '$app/state';
import type { Airport, Flight, FlightPassenger } from '$lib/db/types';
import { distanceBetween, toTitleCase } from '$lib/utils';
import { nowIn } from '$lib/utils/datetime';

type ExcludedType<T, U> = {
  [P in keyof T as P extends keyof U ? never : P]: T[P];
};

type FlightOverrides = {
  date: TZDate | null;
  dateStart: TZDate | null;
  dateEnd: TZDate | null;
  departure: TZDate | null;
  arrival: TZDate | null;
  distance: number | null;
  raw: Flight;
};
export type FlightData = ExcludedType<Flight, FlightOverrides> &
  FlightOverrides;

export const formatSimpleFlight = (flight: FlightData) => ({
  id: flight.id,
  airports: [flight.from?.id, flight.to?.id],
  fromCode: flight.from?.iata ?? flight.from?.icao ?? 'N/A',
  toCode: flight.to?.iata ?? flight.to?.icao ?? 'N/A',
  date: flight.date,
  dateStart: flight.dateStart,
  datePrecision: flight.datePrecision,
  airline: flight.airline,
});

export type SimpleFlight = ReturnType<typeof formatSimpleFlight>;

export const prepareFlightData = (data: Flight[]): FlightData[] => {
  if (!data) return [];

  return data
    .map((flight) => {
      const timeline = resolveFlightTimeline(flight);

      return {
        ...flight,
        date: timeline.recordedDeparture ?? timeline.dateStart,
        dateStart: timeline.dateStart,
        dateEnd: timeline.dateEnd,
        departure: timeline.recordedDeparture,
        arrival: timeline.recordedArrival,
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
      flights: SimpleFlight[];
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
        (f) => f.dateStart && isAfter(f.dateStart, nowIn('UTC')),
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
    flights: SimpleFlight[];
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

export const formatSeat = (f: FlightData) => {
  const userId = page.data.user?.id;
  return formatSeatForUser(f, userId);
};

export const formatSeatForUser = (
  f: FlightData,
  userId: string | null | undefined,
) => {
  const t = (s: string) => toTitleCase(s);

  let passenger;
  if (userId) {
    passenger = f.passengers.find((item) => item.userId === userId);
  } else if (f.passengers.length === 1) {
    passenger = f.passengers[0];
  }
  if (!passenger) return null;

  if (passenger.seat && passenger.seatNumber && passenger.seatClass) {
    return `${t(passenger.seatClass)} (${passenger.seat} ${passenger.seatNumber})`;
  }
  if (passenger.seat && passenger.seatNumber) {
    return `${passenger.seat} ${passenger.seatNumber}`;
  }
  if (passenger.seat && passenger.seatClass) {
    return `${t(passenger.seatClass)} (${passenger.seat})`;
  }
  if (passenger.seatClass) {
    return t(passenger.seatClass);
  }
  if (passenger.seat) {
    return t(passenger.seat);
  }
  return null;
};

export const getFlightPassengerLabel = (passenger: FlightPassenger) => {
  return passenger.user?.displayName ?? passenger.guestName ?? null;
};

export const getFlightPassengerToken = (passenger: FlightPassenger) => {
  if (passenger.userId) {
    return `user:${passenger.userId}`;
  }

  if (passenger.guestName) {
    return `guest:${passenger.guestName}`;
  }

  return null;
};

export const getFlightPassengerLabels = (flight: FlightData) => {
  return flight.passengers
    .map((passenger) => getFlightPassengerLabel(passenger))
    .filter((value): value is string => Boolean(value));
};
