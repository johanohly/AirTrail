import { differenceInSeconds, format } from 'date-fns';

import { page } from '$app/state';
import type { PlatformOptions } from '$lib/components/modals/settings/pages/import-page';
import type { Airline, CreateFlight, SeatClasses } from '$lib/db/types';
import { api } from '$lib/trpc';
import { parseLocalISO } from '$lib/utils/datetime';

const AITA_SEAT_CLASS_MAP: Record<string, (typeof SeatClasses)[number]> = {
  FIRST: 'first',
  BUSINESS: 'business',
  PLUS: 'economy+',
  ECONOMY: 'economy',
  ECOLIGHT: 'economy',
};

export const processAITAFile = async (
  input: string,
  options: PlatformOptions,
) => {
  const tripPattern =
    /^Ownership\.(\w+);[^\r\n]*\sflights:\s([\s\S]+?)\shotels:/gm;
  const flightPattern =
    /^([^;\n\r]*);(\w*);.*?;(\w{2,4};\d{2,4});(\w*);(\w{3});(\w{3});([\d\-T:]+);([\d\-T:]+);([\d\-T:]+);([\d\-T:]+);(.*)/gm;

  const flights: CreateFlight[] = [];
  const unknownAirports: Record<string, number[]> = {};
  const unknownAirlines: Record<string, number[]> = {};

  const userId = page.data.user?.id;
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

      const mappedFrom = rawFrom
        ? options.airportMapping?.[rawFrom]
        : undefined;
      const mappedTo = rawTo ? options.airportMapping?.[rawTo] : undefined;
      const from =
        mappedFrom ||
        (rawFrom ? await api.airport.getFromIata.query(rawFrom) : null);
      const to =
        mappedTo || (rawTo ? await api.airport.getFromIata.query(rawTo) : null);

      const departure = rawDeparture
        ? parseLocalISO(rawDeparture, 'UTC')
        : undefined;
      const arrival = rawArrival ? parseLocalISO(rawArrival, 'UTC') : undefined;

      if (!flightNumber || !departure || !arrival) {
        console.error('Invalid flight details:', match);
        continue;
      }

      const airlineIata = flightNumber.split(';')[0];
      const mappedAirline = airlineIata
        ? options.airlineMapping?.[airlineIata]
        : undefined;
      let airline: Airline | null = mappedAirline || null;
      if (!airline && options.airlineFromFlightNumber && airlineIata) {
        airline = (await api.airline.getByIata.query(airlineIata)) ?? null;
      }

      const seatNumber = rawSeat && rawSeat !== 'None' ? rawSeat : null;
      let seatClass = null;
      if (rawSeatClass) {
        const cleanSeatClass = rawSeatClass.replace(/\s/g, '').split('(')[0];
        seatClass = AITA_SEAT_CLASS_MAP?.[cleanSeatClass ?? 'noop'] ?? null;
      }

      const flightIndex = flights.length;

      // Track unknown codes with flight index
      if (!from && rawFrom) {
        if (!unknownAirports[rawFrom]) unknownAirports[rawFrom] = [];
        unknownAirports[rawFrom].push(flightIndex);
      }
      if (!to && rawTo) {
        if (!unknownAirports[rawTo]) unknownAirports[rawTo] = [];
        unknownAirports[rawTo].push(flightIndex);
      }
      if (!airline && airlineIata) {
        if (!unknownAirlines[airlineIata]) unknownAirlines[airlineIata] = [];
        unknownAirlines[airlineIata].push(flightIndex);
      }

      flights.push({
        date: format(departure, 'yyyy-MM-dd'),
        from: from || null,
        to: to || null,
        departure: departure.toISOString(),
        arrival: arrival.toISOString(),
        departureScheduled: null,
        arrivalScheduled: null,
        takeoffScheduled: null,
        takeoffActual: null,
        landingScheduled: null,
        landingActual: null,
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
    unknownAirlines,
  };
};
