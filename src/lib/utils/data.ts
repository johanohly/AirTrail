import { AIRPORTS } from '$lib/data/airports';
import type { Flight } from '$lib/db';
import { AIRLINES } from '$lib/data/airlines';
import dayjs from 'dayjs';
import { distanceBetween, toTitleCase } from '$lib/utils';
import { PersistentLRUCache } from '$lib/utils/lru-cache';

const dateFormatter = new Intl.DateTimeFormat('en', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

type ExcludedType<T, U> = {
  [P in keyof T as P extends keyof U ? never : P]: T[P];
};
export type Airport = {
  name: string;
  country: string;
  continent: string;
  lat: number;
  lon: number;
  IATA: string | null;
  ICAO: string;
  wiki: string | null;
};
type FlightOverrides = {
  date: dayjs.Dayjs;
  from: Airport;
  to: Airport;
  distance: number;
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

      return {
        ...flight,
        date: dayjs(flight.date, 'YYYY-MM-DD'),
        from: fromAirport,
        to: toAirport,
        distance:
          distanceBetween(
            [fromAirport.lon, fromAirport.lat],
            [toAirport.lon, toAirport.lat],
          ) / 1000,
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
      };
    }

    routeMap[key].flights.push(formatSimpleFlight(flight));

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
    date: dateFormatter.format(f.date.toDate()),
    airline: f.airline ?? '',
  };
};

export const formatSeat = (f: FlightData) => {
  const t = (s: string) => toTitleCase(s);

  return f.seat && f.seatNumber && f.seatClass
    ? `${t(f.seatClass)} (${f.seat} ${f.seatNumber})`
    : f.seat && f.seatNumber
      ? `${f.seat} ${f.seatNumber}`
      : f.seat && f.seatClass
        ? `${t(f.seatClass)} (${f.seat})`
        : f.seat
          ? f.seat
          : null;
};

export const airportFromICAO = (icao: string): Airport | undefined => {
  return AIRPORTS.find((airport) => airport.ICAO === icao);
};

export const airlineFromICAO = (icao: string) => {
  return AIRLINES.find((airline) => airline.icao === icao) ?? null;
};

const cacheOptions = {
  max: 100,
};
export const airportSearchCache = new PersistentLRUCache<string, Airport[]>(
  cacheOptions,
  'airport-search',
);
