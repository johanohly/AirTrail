import { format } from 'date-fns';
import { Sync as Factory } from 'factory.ts';
import { Kysely } from 'kysely';

import { AIRPORTS } from '../../src/lib/data/airports';
import { createManyFlightsPrimitive } from '../../src/lib/db/queries';
import type { DB } from '../../src/lib/db/schema';
import type { CreateFlight } from '../../src/lib/db/types';
import { estimateFlightDuration } from '../../src/lib/utils/datetime';
import { distanceBetween } from '../../src/lib/utils/distance';

const routes = [
  { from: 'EGLL', to: 'KJFK' }, // London-Heathrow to New York-JFK
  { from: 'KMIA', to: 'OMDB' }, // Miami to Dubai
  { from: 'HECA', to: 'OEJN' }, // Cairo to Jeddah
  { from: 'VHHH', to: 'RCTP' }, // Hong Kong to Taipei-Taoyuan
  { from: 'OMDB', to: 'OERK' }, // Dubai to Riyadh
  { from: 'VTBS', to: 'RKSI' }, // Bangkok-Suvarnabhumi to Seoul-Incheon
];

const baseFlightFactory = Factory.makeFactory<CreateFlight>({
  seats: [{ userId: 'PLACEHOLDER' }],
  // @ts-expect-error - TS doesn't understand the modulo operation
  from: Factory.each((i) => routes[i % routes.length].from),
  // @ts-expect-error - TS doesn't understand the modulo operation
  to: Factory.each((i) => routes[i % routes.length].to),
  date: Factory.each(() =>
    format(
      new Date(Date.now() - Math.random() * 10 * 365 * 24 * 60 * 60 * 1000), // Random date within the last 10 years
      'yyyy-MM-dd',
    ),
  ),
}).withDerivation2(['from', 'to'], 'duration', (fromIcao, toIcao) => {
  const from = AIRPORTS.find((a) => a.ICAO === fromIcao);
  const to = AIRPORTS.find((a) => a.ICAO === toIcao);
  return from && to
    ? estimateFlightDuration(
        distanceBetween([from.lon, from.lat], [to.lon, to.lat]) / 1000,
      )
    : 0;
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
