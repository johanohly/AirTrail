import { format } from 'date-fns';
import { Kysely } from 'kysely';

import type { DB } from '../../src/lib/db/schema';
import type { CreateFlight } from '../../src/lib/db/types';

export const seedFlight = async (db: Kysely<DB>, userId: string) => {
  await createFlight(db, {
    seats: [
      { userId, seat: 'window', seatNumber: '11F', seatClass: 'economy' },
    ],
    from: 'EKCH',
    to: 'ESSA',
    date: format(new Date(), 'yyyy-MM-dd'),
    duration: 70 * 60,
  });
};

const createFlight = async (db: Kysely<DB>, data: CreateFlight) => {
  await db.transaction().execute(async (trx) => {
    const { seats, ...flightData } = data;
    const resp = await trx
      .insertInto('flight')
      .values(flightData)
      .returning('id')
      .executeTakeFirstOrThrow();

    const seatData = seats.map((seat) => ({
      flightId: resp.id,
      userId: seat.userId,
      guestName: seat.guestName,
      seat: seat.seat,
      seatNumber: seat.seatNumber,
      seatClass: seat.seatClass,
    }));

    await trx.insertInto('seat').values(seatData).executeTakeFirstOrThrow();
  });
};
