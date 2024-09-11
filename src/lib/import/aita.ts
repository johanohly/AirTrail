import dayjs from 'dayjs';
import { airportFromIATA } from '$lib/utils/data/airports';
import { toISOString } from '$lib/utils';
import type { CreateFlight } from '$lib/db/types';
import { get } from 'svelte/store';
import { page } from '$app/stores';

export const processAITAFile = (input: string) => {
  const flightPattern =
    /^.*?;(\w{2};\d{3,4});(\w*);(\w{3});(\w{3});([\d\-T:]+);([\d\-T:]+);([\d\-T:]+);([\d\-T:]+);(.*)/gm;

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

    const departure = dayjs(rawDeparture);
    const arrival = dayjs(rawArrival);

    if (!flightNumber || !from || !to || !departure || !arrival) {
      console.error('Invalid flight details:', match);
      continue;
    }

    flights.push({
      date: departure.format('YYYY-MM-DD'),
      from: from.ICAO,
      to: to.ICAO,
      departure: toISOString(departure),
      arrival: toISOString(arrival),
      duration: arrival.diff(departure, 'seconds'),
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
