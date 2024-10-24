import { airportFromIATA } from '$lib/utils/data/airports';
import type { CreateFlight } from '$lib/db/types';
import { get } from 'svelte/store';
import { page } from '$app/stores';
import { differenceInSeconds, format } from 'date-fns';
import { parseLocalISO } from '$lib/utils/datetime';

export const processAITAFile = (input: string) => {
  const flightPattern =
    /^.*?;(\w{2,4};\d{2,4});(\w*);(\w{3});(\w{3});([\d\-T:]+);([\d\-T:]+);([\d\-T:]+);([\d\-T:]+);(.*)/gm;

  const flights: CreateFlight[] = [];
  let match;

  const userId = get(page).data.user?.id;
  if (!userId) {
    throw new Error('User not found');
  }

  while ((match = flightPattern.exec(input)) !== null) {
    const [, flightNumber, , rawFrom, rawTo, rawDeparture, rawArrival] = match;

    const from = rawFrom ? airportFromIATA(rawFrom) : undefined;
    const to = rawTo ? airportFromIATA(rawTo) : undefined;

    const departure = rawDeparture
      ? parseLocalISO(rawDeparture, 'UTC')
      : undefined;
    const arrival = rawArrival ? parseLocalISO(rawArrival, 'UTC') : undefined;

    if (!flightNumber || !from || !to || !departure || !arrival) {
      console.error('Invalid flight details:', match);
      continue;
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
      airline: null,
      aircraft: null,
      aircraftReg: null,
      note: null,
      seats: [
        {
          userId,
          seat: null,
          seatNumber: null,
          seatClass: null,
          guestName: null,
        },
      ],
    });
  }

  return flights;
};
