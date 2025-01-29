import { format } from 'date-fns';
import { Sync as Factory } from 'factory.ts';
import { Kysely } from 'kysely';

import { createManyFlightsPrimitive } from '../../src/lib/db/queries';
import type { DB } from '../../src/lib/db/schema';
import type { CreateFlight } from '../../src/lib/db/types';

const routes = [
  { from: 'EGLL', to: 'KJFK', duration: 26637 }, // London-Heathrow to New York-JFK
  { from: 'KMIA', to: 'OMDB', duration: 36883 }, // Miami to Dubai
  { from: 'HECA', to: 'OEJN', duration: 7305 }, // Cairo to Jeddah
  { from: 'VHHH', to: 'RCTP', duration: 5489 }, // Hong Kong to Taipei-Taoyuan
  { from: 'OMDB', to: 'OERK', duration: 4214 }, // Dubai to Riyadh
  { from: 'VTBS', to: 'RKSI', duration: 18386 }, // Bangkok-Suvarnabhumi to Seoul-Incheon
];

const baseFlightFactory = Factory.makeFactory<CreateFlight>({
  seats: [{ userId: 'PLACEHOLDER' }],
  // @ts-expect-error - TS doesn't understand the modulo operation
  from: Factory.each((i) => routes[i % routes.length].from),
  // @ts-expect-error - TS doesn't understand the modulo operation
  to: Factory.each((i) => routes[i % routes.length].to),
  // @ts-expect-error - TS doesn't understand the modulo operation
  duration: Factory.each((i) => routes[i % routes.length].duration),
  date: Factory.each(() =>
    format(
      new Date(Date.now() - Math.random() * 10 * 365 * 24 * 60 * 60 * 1000), // Random date within the last 10 years
      'yyyy-MM-dd',
    ),
  ),
});

export const seedFlight = async (db: Kysely<DB>, userId: string) => {
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

  await createManyFlightsPrimitive(db, flights);
};
