import { AIRPORTS } from '$lib/data/airports';
import { distanceBetween } from '$lib/utils/distance';
import type { APIFlight } from '$lib/db';
import { toTitleCase } from '$lib/utils/other';
import { AIRLINES } from '$lib/data/airlines';
import dayjs from 'dayjs';

const dateFormatter = new Intl.DateTimeFormat('en', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

export const prepareFlightArcData = (data: APIFlight[]) => {
  if (!data) return [];

  const routeMap: {
    [key: string]: {
      distance: number;
      from: { position: [number, number], iata: string | null, name: string, country: string };
      to: { position: [number, number], iata: string | null, name: string, country: string };
      flights: { route: string, date: string, airline: string | null }[];
      airlines: string[];
    }
  } = {};

  data.forEach((flight) => {
    const fromAirport = airportFromIata(flight.from);
    const toAirport = airportFromIata(flight.to);
    if (!fromAirport || !toAirport) return;

    const key = [fromAirport.name, toAirport.name].sort().join('-');
    if (!routeMap[key]) {
      routeMap[key] = {
        distance: distanceBetween(
          [fromAirport.lon, fromAirport.lat],
          [toAirport.lon, toAirport.lat],
        ) / 1000,
        from: {
          position: [fromAirport.lon, fromAirport.lat],
          iata: fromAirport.IATA,
          name: fromAirport.name,
          country: fromAirport.country,
        },
        to: {
          position: [toAirport.lon, toAirport.lat],
          iata: toAirport.IATA,
          name: toAirport.name,
          country: toAirport.country,
        },
        flights: [],
        airlines: [],
      };
    }

    routeMap[key].flights.push({
      route: `${fromAirport.IATA ?? fromAirport.ICAO} - ${toAirport.IATA ?? toAirport.ICAO}`,
      date: flight.departure ? dateFormatter.format(dayjs.unix(flight.departure).toDate()) : '',
      airline: flight.airline ?? '',
    });

    if (flight.airline) {
      if (!routeMap[key].airlines.includes(flight.airline)) {
        routeMap[key].airlines.push(flight.airline);
      }
    }
  });

  return Object.values(routeMap);
};

export const formatSeat = (f: APIFlight) => {
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

export const airportFromIata = (
  iata: string,
): (typeof AIRPORTS)[0] | undefined => {
  return AIRPORTS.find((airport) => airport.IATA === iata);
};

export const airlineFromIata = (iata: string) => {
  return AIRLINES.find((airline) => airline.iata === iata) ?? null;
};
