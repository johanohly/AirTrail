import { differenceInSeconds, format } from 'date-fns';
import { get } from 'svelte/store';

import { page } from '$app/stores';
import type { PlatformOptions } from '$lib/components/modals/settings/pages/import-page';
import type { CreateFlight, SeatClasses } from '$lib/db/types';
import { airlineFromIATA } from '$lib/utils/data/airlines';
import { airportFromIATA } from '$lib/utils/data/airports';
import { parseLocalISO } from '$lib/utils/datetime';

const AITA_SEAT_CLASS_MAP: Record<string, (typeof SeatClasses)[number]> = {
  FIRST: 'first',
  BUSINESS: 'business',
  PLUS: 'economy+',
  ECONOMY: 'economy',
  ECOLIGHT: 'economy',
};

export const processAITAFile = (input: string, options: PlatformOptions) => {
  const tripPattern =
    /^Ownership\.(\w+);[^\r\n]*\sflights:\s([\s\S]+?)\shotels:/gm;
  const flightPattern =
    /^([^;\n\r]*);(\w*);.*?;(\w{2,4};\d{2,4});(\w*);(\w{3});(\w{3});([\d\-T:]+);([\d\-T:]+);([\d\-T:]+);([\d\-T:]+);(.*)/gm;

  const flights: CreateFlight[] = [];
  const unknownAirports: string[] = [];

  const userId = get(page).data.user?.id;
  if (!userId) {
    throw new Error('User not found');
  }

  for (const match of input.matchAll(tripPattern)) {
    const [, owner, flightsInput] = match;
    if (!owner || !flightsInput) {
      continue;
    }

    if (options.filterOwner && owner !== 'MINE') {
      continue;
    }

    for (const match of flightsInput.matchAll(flightPattern)) {
      const [
        ,
        rawSeatClass,
        rawSeat,
        flightNumber,
        ,
        rawFrom,
        rawTo,
        rawDeparture,
        rawArrival,
      ] = match;

      const from = rawFrom ? airportFromIATA(rawFrom) : undefined;
      const to = rawTo ? airportFromIATA(rawTo) : undefined;

      const departure = rawDeparture
        ? parseLocalISO(rawDeparture, 'UTC')
        : undefined;
      const arrival = rawArrival ? parseLocalISO(rawArrival, 'UTC') : undefined;

      if (!flightNumber || !departure || !arrival) {
        console.error('Invalid flight details:', match);
        continue;
      }

      if (!from || !to) {
        if (!from && rawFrom && !unknownAirports.includes(rawFrom)) {
          unknownAirports.push(rawFrom);
        }
        if (!to && rawTo && !unknownAirports.includes(rawTo)) {
          unknownAirports.push(rawTo);
        }
        continue;
      }

      const airlineIata = flightNumber.split(';')[0];
      let airline: string | null = null;
      if (options.airlineFromFlightNumber && airlineIata) {
        airline = airlineFromIATA(airlineIata)?.icao ?? null;
      }

      const seatNumber = rawSeat && rawSeat !== 'None' ? rawSeat : null;
      let seatClass = null;
      if (rawSeatClass) {
        const cleanSeatClass = rawSeatClass.replace(/\s/g, '').split('(')[0];
        seatClass = AITA_SEAT_CLASS_MAP?.[cleanSeatClass ?? 'noop'] ?? null;
      }

      flights.push({
        date: format(departure, 'yyyy-MM-dd'),
        from: from.ICAO,
        to: to.ICAO,
        departure: departure.toISOString(),
        arrival: arrival.toISOString(),
        duration: differenceInSeconds(arrival, departure),
        flightNumber: flightNumber?.replace(';', ''),
        flightReason: null,
        airline,
        aircraft: null,
        aircraftReg: null,
        note: null,
        seats: [
          {
            userId,
            seat: null,
            seatNumber,
            seatClass,
            guestName: null,
          },
        ],
      });
    }
  }

  return {
    flights,
    unknownAirports,
  };
};
