import { format } from 'date-fns';
import { Kysely } from 'kysely';

import type { DB } from '../../src/lib/db/schema';
import { createFlightPrimitive } from '../../src/lib/server/utils/flight';

export const seedFlight = async (db: Kysely<DB>, userId: string) => {
  await createFlightPrimitive(db, {
    seats: [
      { userId, seat: 'window', seatNumber: '11F', seatClass: 'economy' },
    ],
    from: 'EKCH',
    to: 'ESSA',
    date: format(new Date(), 'yyyy-MM-dd'),
    duration: 70 * 60,
  });
};
