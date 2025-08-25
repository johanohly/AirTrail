import { format } from 'date-fns';
import { Sync as Factory } from 'factory.ts';
import { Kysely } from 'kysely';

import type { DB } from '../../src/lib/db/schema';
import type { CreateFlight, Airport } from '../../src/lib/db/types';

const routes = [
  { from: 'EGLL', to: 'KJFK', duration: 26637 }, // London-Heathrow to New York-JFK
  { from: 'KMIA', to: 'OMDB', duration: 36883 }, // Miami to Dubai
  { from: 'HECA', to: 'OEJN', duration: 7305 }, // Cairo to Jeddah
  { from: 'VHHH', to: 'RCTP', duration: 5489 }, // Hong Kong to Taipei-Taoyuan
  { from: 'OMDB', to: 'OERK', duration: 4214 }, // Dubai to Riyadh
  { from: 'VTBS', to: 'RKSI', duration: 18386 }, // Bangkok-Suvarnabhumi to Seoul-Incheon
];

const seedAirports = [
  {
    icao: 'EGLL',
    name: 'London Heathrow Airport',
    lat: 51.47,
    lon: -0.4543,
    country: 'GB',
    continent: 'EU',
    tz: 'Europe/London',
    type: 'large_airport',
  },
  {
    icao: 'KJFK',
    name: 'John F Kennedy International Airport',
    lat: 40.6413,
    lon: -73.7781,
    country: 'US',
    continent: 'NA',
    tz: 'America/New_York',
    type: 'large_airport',
  },
  {
    icao: 'KMIA',
    name: 'Miami International Airport',
    lat: 25.7959,
    lon: -80.287,
    country: 'US',
    continent: 'NA',
    tz: 'America/New_York',
    type: 'large_airport',
  },
  {
    icao: 'OMDB',
    name: 'Dubai International Airport',
    lat: 25.2532,
    lon: 55.3657,
    country: 'AE',
    continent: 'AS',
    tz: 'Asia/Dubai',
    type: 'large_airport',
  },
  {
    icao: 'HECA',
    name: 'Cairo International Airport',
    lat: 30.1219,
    lon: 31.4056,
    country: 'EG',
    continent: 'AF',
    tz: 'Africa/Cairo',
    type: 'large_airport',
  },
  {
    icao: 'OEJN',
    name: 'King Abdulaziz International Airport',
    lat: 21.6796,
    lon: 39.1565,
    country: 'SA',
    continent: 'AS',
    tz: 'Asia/Riyadh',
    type: 'large_airport',
  },
  {
    icao: 'VHHH',
    name: 'Hong Kong International Airport',
    lat: 22.308,
    lon: 113.9185,
    country: 'HK',
    continent: 'AS',
    tz: 'Asia/Hong_Kong',
    type: 'large_airport',
  },
  {
    icao: 'RCTP',
    name: 'Taiwan Taoyuan International Airport',
    lat: 25.0797,
    lon: 121.2342,
    country: 'TW',
    continent: 'AS',
    tz: 'Asia/Taipei',
    type: 'large_airport',
  },
  {
    icao: 'OERK',
    name: 'King Khalid International Airport',
    lat: 24.9576,
    lon: 46.6988,
    country: 'SA',
    continent: 'AS',
    tz: 'Asia/Riyadh',
    type: 'large_airport',
  },
  {
    icao: 'VTBS',
    name: 'Suvarnabhumi Airport',
    lat: 13.69,
    lon: 100.7501,
    country: 'TH',
    continent: 'AS',
    tz: 'Asia/Bangkok',
    type: 'large_airport',
  },
  {
    icao: 'RKSI',
    name: 'Incheon International Airport',
    lat: 37.4602,
    lon: 126.4407,
    country: 'KR',
    continent: 'AS',
    tz: 'Asia/Seoul',
    type: 'large_airport',
  },
];

export const seedFlight = async (db: Kysely<DB>, userId: string) => {
  // First, create the airports as custom airports (as requested in the issue)
  const createdAirports = new Map<string, number>();

  for (const airportData of seedAirports) {
    const existing = await db
      .selectFrom('airport')
      .select('id')
      .where('icao', '=', airportData.icao)
      .executeTakeFirst();

    if (existing) {
      createdAirports.set(airportData.icao, existing.id);
    } else {
      const newAirport = await db
        .insertInto('airport')
        .values(airportData)
        .returning('id')
        .executeTakeFirstOrThrow();

      createdAirports.set(airportData.icao, newAirport.id);
    }
  }

  // Create flight factory that uses airport IDs
  const baseFlightFactory = Factory.makeFactory<CreateFlight>({
    seats: [{ userId: 'PLACEHOLDER' }],
    from: Factory.each((i) => ({
      // @ts-expect-error - TS doesn't understand the modulo operation
      id: createdAirports.get(routes[i % routes.length].from)!,
    })),
    to: Factory.each((i) => ({
      // @ts-expect-error - TS doesn't understand the modulo operation
      id: createdAirports.get(routes[i % routes.length].to)!,
    })),
    // @ts-expect-error - TS doesn't understand the modulo operation
    duration: Factory.each((i) => routes[i % routes.length].duration),
    date: Factory.each(() =>
      format(
        new Date(Date.now() - Math.random() * 10 * 365 * 24 * 60 * 60 * 1000), // Random date within the last 10 years
        'yyyy-MM-dd',
      ),
    ),
  });

  const flights = baseFlightFactory.buildList(10, {
    seats: [
      {
        userId,
        seat: 'window',
        seatNumber: '11F',
        seatClass: 'economy',
      },
    ],
  });

  // Insert flights directly with proper foreign key relationships
  await db.transaction().execute(async (trx) => {
    const insertedFlights = await trx
      .insertInto('flight')
      .values(
        flights.map(
          ({ seats: _, from, to, aircraft, airline, ...flightData }) => ({
            ...flightData,
            fromId: from.id,
            toId: to.id,
            aircraftId: aircraft?.id ?? null,
            airlineId: airline?.id ?? null,
          }),
        ),
      )
      .returning('id')
      .execute();

    // Insert seats for each flight
    const seatData = insertedFlights.flatMap((flight, index) => {
      const flightInput = flights[index];

      if (flightInput && flightInput.seats.length > 0) {
        return flightInput.seats.map((seat) => ({
          flightId: flight.id,
          userId: seat.userId,
          guestName: seat.guestName,
          seat: seat.seat,
          seatNumber: seat.seatNumber,
          seatClass: seat.seatClass,
        }));
      }

      return [];
    });

    if (seatData.length > 0) {
      await trx.insertInto('seat').values(seatData).execute();
    }
  });
};
