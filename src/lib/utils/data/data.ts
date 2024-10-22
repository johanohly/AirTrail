import type { Flight } from '$lib/db';
import dayjs from 'dayjs';
import { parse, parseISO } from 'date-fns';
import { distanceBetween, toTitleCase } from '$lib/utils';
import { type Airport, airportFromICAO } from '$lib/utils/data/airports';
import { get } from 'svelte/store';
import { page } from '$app/stores';
import { TZDate } from '@date-fns/tz';
import { tz } from '@date-fns/tz/tz';
import {
  formatAsDate,
  parseLocal,
  parseLocalISO,
  parseLocalize,
  parseLocalizeISO,
} from '$lib/utils/datetime';

type ExcludedType<T, U> = {
  [P in keyof T as P extends keyof U ? never : P]: T[P];
};

type FlightOverrides = {
  date: TZDate;
  departure: TZDate | null;
  arrival: TZDate | null;
  from: Airport;
  to: Airport;
  distance: number;
  raw: Flight;
};
export type FlightData = ExcludedType<Flight, FlightOverrides> &
  FlightOverrides;

export const prepareFlightData = (data: Flight[]): FlightData[] => {
  if (!data) return [];

  return data
    .map((flight) => {
      const fromAirport = airportFromICAO(flight.from);
      const toAirport = airportFromICAO(flight.to);
      if (!fromAirport || !toAirport) return null;

      const departure = flight.departure
        ? parseLocalizeISO(flight.departure, fromAirport.tz)
        : null;

      return {
        ...flight,
        date:
          departure ?? parseLocalize(flight.date, 'yyyy-MM-dd', fromAirport.tz),
        from: fromAirport,
        to: toAirport,
        departure,
        arrival: flight.arrival
          ? parseLocalizeISO(flight.arrival, toAirport.tz)
          : null,
        distance:
          distanceBetween(
            [fromAirport.lon, fromAirport.lat],
            [toAirport.lon, toAirport.lat],
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
      from: {
        position: [number, number];
        iata: string | null;
        icao: string;
        name: string;
        country: string;
      };
      to: {
        position: [number, number];
        iata: string | null;
        icao: string;
        name: string;
        country: string;
      };
      flights: { route: string; date: string; airline: string | null }[];
      airlines: string[];
      exclusivelyFuture: boolean;
    };
  } = {};

  data.forEach((flight) => {
    const key = [flight.from.name, flight.to.name].sort().join('-');
    if (!routeMap[key]) {
      routeMap[key] = {
        distance: flight.distance,
        from: {
          position: [flight.from.lon, flight.from.lat],
          iata: flight.from.IATA,
          icao: flight.from.ICAO,
          name: flight.from.name,
          country: flight.from.country,
        },
        to: {
          position: [flight.to.lon, flight.to.lat],
          iata: flight.to.IATA,
          icao: flight.to.ICAO,
          name: flight.to.name,
          country: flight.to.country,
        },
        flights: [],
        airlines: [],
        exclusivelyFuture: false,
      };
    }

    routeMap[key].flights.push(formatSimpleFlight(flight));

    if (routeMap[key].flights.every((f) => dayjs(f.date) > dayjs())) {
      routeMap[key].exclusivelyFuture = true;
    }

    if (flight.airline) {
      if (!routeMap[key].airlines.includes(flight.airline)) {
        routeMap[key].airlines.push(flight.airline);
      }
    }
  });

  return Object.values(routeMap);
};

export const prepareVisitedAirports = (data: FlightData[]) => {
  const visited: {
    position: number[];
    meta: { name: string; country: string; iata: string | null; icao: string };
    arrivals: number;
    departures: number;
    airlines: string[];
    flights: ReturnType<typeof formatSimpleFlight>[];
    frequency: number;
  }[] = [];
  const formatAirport = (flight: FlightData, direction: 'from' | 'to') => {
    const airport = flight[direction];
    let visit = visited.find((v) => v.meta.name === airport.name);
    if (!visit) {
      visit = {
        position: [airport.lon, airport.lat],
        meta: {
          name: airport.name,
          country: airport.country,
          iata: airport.IATA,
          icao: airport.ICAO,
        },
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

    if (flight.airline && !visit.airlines.includes(flight.airline)) {
      visit.airlines.push(flight.airline);
    }

    visit.flights.push(formatSimpleFlight(flight));
  };

  data.forEach((flight) => {
    formatAirport(flight, 'from');
    formatAirport(flight, 'to');
  });

  const MIN_FREQUENCY = 0.5;
  const MAX_FREQUENCY = 3;
  const combinedFrequencies = visited.map((v) => v.arrivals + v.departures);

  // Find the maximum combined frequency
  const maxFrequency = Math.max(...combinedFrequencies, 0); // Ensure it's not zero

  visited.forEach((v) => {
    // Calculate the combined frequency for the airport
    const combinedFrequency = v.arrivals + v.departures;

    // Normalize and scale the frequency
    const normalizedFrequency =
      maxFrequency === 0 ? 0 : combinedFrequency / maxFrequency;
    v.frequency = Math.min(
      MAX_FREQUENCY,
      Math.max(
        MIN_FREQUENCY,
        normalizedFrequency * (MAX_FREQUENCY - MIN_FREQUENCY) + MIN_FREQUENCY,
      ),
    );
  });

  return visited;
};

const formatSimpleFlight = (f: FlightData) => {
  return {
    route: `${f.from.IATA ?? f.from.ICAO} - ${f.to.IATA ?? f.to.ICAO}`,
    date: formatAsDate(f.date, f.from.tz, true, true),
    airline: f.airline ?? '',
  };
};

export const formatSeat = (f: FlightData) => {
  const t = (s: string) => toTitleCase(s);

  const userId = get(page).data.user?.id;
  if (!userId) return null;

  const s = f.seats.find((seat) => seat.userId === userId);
  if (!s) return null;

  return s.seat && s.seatNumber && s.seatClass
    ? `${t(s.seatClass)} (${s.seat} ${s.seatNumber})`
    : s.seat && s.seatNumber
      ? `${s.seat} ${s.seatNumber}`
      : s.seat && s.seatClass
        ? `${t(s.seatClass)} (${s.seat})`
        : s.seatClass
          ? t(s.seatClass)
          : s.seat
            ? t(s.seat)
            : null;
};
