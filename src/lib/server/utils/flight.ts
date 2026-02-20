import type { TZDate } from '@date-fns/tz';
import { differenceInSeconds, format, isBefore, parseISO } from 'date-fns';
import { type Insertable, sql } from 'kysely';
import { z } from 'zod';

import { db } from '$lib/db';
import {
  createFlightPrimitive,
  createFlightPrimitiveWithConnection,
  createManyFlightsPrimitive,
  getFlightPrimitive,
  listFlightBaseQuery,
  listFlightPrimitive,
  updateFlightPrimitive,
  updateFlightPrimitiveWithConnection,
} from '$lib/db/queries';
import type { DB } from '$lib/db/schema';
import type { CreateFlight, Flight, User } from '$lib/db/types';
import {
  CustomFieldValidationError,
  persistEntityCustomFields,
} from '$lib/server/utils/custom-fields';
import { distanceBetween } from '$lib/utils';
import {
  estimateFlightDuration,
  isBeforeEpoch,
  mergeTimeWithDate,
  parseLocalISO,
  toUtc,
} from '$lib/utils/datetime';
import type { ErrorActionResult } from '$lib/utils/forms';
import type { flightSchema } from '$lib/zod/flight';

export const listFlightsQuery = (userId: string) => {
  return listFlightBaseQuery(db, userId);
};

export const listFlights = async (userId: string) => {
  return await listFlightPrimitive(db, userId);
};

export const getFlight = async (id: number) => {
  return await getFlightPrimitive(db, id);
};

export const createFlight = async (data: CreateFlight) => {
  return await createFlightPrimitive(db, data);
};

export const validateAndSaveFlight = async (
  user: User,
  data: z.infer<typeof flightSchema>,
): Promise<ErrorActionResult & { id?: number }> => {
  const pathError = (path: string, message: string) => {
    return { success: false, type: 'path', path, message } as const;
  };

  const parseDateTimeField = (
    date: string | null,
    time: string | null,
    tzId: string,
    path: string,
  ) => {
    if (!date || !time) return { value: null as TZDate | null };
    try {
      return { value: mergeTimeWithDate(date, time, tzId) };
    } catch {
      return { error: pathError(path, 'Invalid time format') };
    }
  };

  const from = data.from;
  const to = data.to;

  // Either departure or departureScheduled must be set
  if (!data.departure && !data.departureScheduled) {
    return pathError('departure', 'Select a departure date');
  }

  // Use departure if available, otherwise fall back to departureScheduled for the date field
  const primaryDepartureDate = data.departure ?? data.departureScheduled;
  const departureDate = parseISO(primaryDepartureDate!);
  if (isBeforeEpoch(departureDate)) {
    // Y2K38
    return pathError(
      data.departure ? 'departure' : 'departureScheduled',
      'Too far in the past',
    );
  }

  let departure: TZDate | undefined;
  if (data.departure) {
    try {
      departure = data.departureTime
        ? mergeTimeWithDate(data.departure, data.departureTime, from.tz)
        : undefined;
    } catch {
      return pathError('departureTime', 'Invalid time format');
    }
  }

  const departureScheduledResult = parseDateTimeField(
    data.departureScheduled,
    data.departureScheduledTime,
    from.tz,
    'departureScheduledTime',
  );
  if (departureScheduledResult.error) return departureScheduledResult.error;
  const departureScheduled = departureScheduledResult.value;

  const takeoffScheduledResult = parseDateTimeField(
    data.takeoffScheduled,
    data.takeoffScheduledTime,
    from.tz,
    'takeoffScheduledTime',
  );
  if (takeoffScheduledResult.error) return takeoffScheduledResult.error;
  const takeoffScheduled = takeoffScheduledResult.value;

  const takeoffActualResult = parseDateTimeField(
    data.takeoffActual,
    data.takeoffActualTime,
    from.tz,
    'takeoffActualTime',
  );
  if (takeoffActualResult.error) return takeoffActualResult.error;
  const takeoffActual = takeoffActualResult.value;

  const arrivalDate = data.arrival
    ? parseLocalISO(data.arrival, to.tz)
    : undefined;
  if (arrivalDate && isBeforeEpoch(arrivalDate)) {
    return pathError('arrival', 'Too far in the past');
  }
  if (arrivalDate && !data.arrivalTime) {
    return pathError('arrival', 'Cannot have arrival date without time');
  }

  if (data.arrivalTime && !data.arrival) {
    data.arrival = data.departure;
  }

  let arrival: TZDate | undefined;
  try {
    arrival =
      data.arrival && data.arrivalTime
        ? mergeTimeWithDate(data.arrival, data.arrivalTime, to.tz)
        : undefined;
  } catch {
    return pathError('arrivalTime', 'Invalid time format');
  }

  const arrivalScheduledResult = parseDateTimeField(
    data.arrivalScheduled,
    data.arrivalScheduledTime,
    to.tz,
    'arrivalScheduledTime',
  );
  if (arrivalScheduledResult.error) return arrivalScheduledResult.error;
  const arrivalScheduled = arrivalScheduledResult.value;

  const landingScheduledResult = parseDateTimeField(
    data.landingScheduled,
    data.landingScheduledTime,
    to.tz,
    'landingScheduledTime',
  );
  if (landingScheduledResult.error) return landingScheduledResult.error;
  const landingScheduled = landingScheduledResult.value;

  const landingActualResult = parseDateTimeField(
    data.landingActual,
    data.landingActualTime,
    to.tz,
    'landingActualTime',
  );
  if (landingActualResult.error) return landingActualResult.error;
  const landingActual = landingActualResult.value;

  if (arrival && departure && isBefore(arrival, departure)) {
    return pathError('arrival', 'Arrival must be after departure');
  }

  let duration: number | null = null;
  if (departure && arrival) {
    duration = differenceInSeconds(arrival, departure);
  } else if (from.id !== to.id) {
    // if the airports are the same, the duration can't be calculated
    const fromLonLat = { lon: from.lon, lat: from.lat };
    const toLonLat = { lon: to.lon, lat: to.lat };
    duration = estimateFlightDuration(
      distanceBetween(fromLonLat, toLonLat) / 1000,
    );
  }

  const {
    flightNumber,
    aircraft,
    aircraftReg,
    airline,
    flightReason,
    note,
    departureTerminal,
    departureGate,
    arrivalTerminal,
    arrivalGate,
    customFields = {},
  } = data;

  const values = {
    from,
    to,
    duration,
    departure: departure ? toUtc(departure).toISOString() : null,
    arrival: arrival ? toUtc(arrival).toISOString() : null,
    departureScheduled: departureScheduled
      ? toUtc(departureScheduled).toISOString()
      : null,
    arrivalScheduled: arrivalScheduled
      ? toUtc(arrivalScheduled).toISOString()
      : null,
    takeoffScheduled: takeoffScheduled
      ? toUtc(takeoffScheduled).toISOString()
      : null,
    takeoffActual: takeoffActual ? toUtc(takeoffActual).toISOString() : null,
    landingScheduled: landingScheduled
      ? toUtc(landingScheduled).toISOString()
      : null,
    landingActual: landingActual ? toUtc(landingActual).toISOString() : null,
    departureTerminal: departureTerminal ?? null,
    departureGate: departureGate ?? null,
    arrivalTerminal: arrivalTerminal ?? null,
    arrivalGate: arrivalGate ?? null,
    date: format(departureDate, 'yyyy-MM-dd'),
    flightNumber,
    aircraft,
    aircraftReg,
    airline,
    flightReason,
    note,
    seats: data.seats,
  };

  const updateId = data.id;
  if (updateId) {
    const flight = await getFlight(updateId);
    if (!flight?.seats.some((seat) => seat.userId === user.id)) {
      return {
        success: false,
        type: 'httpError',
        status: 403,
        message: 'Flight not found or you do not have a seat on this flight',
      };
    }

    try {
      await db.transaction().execute(async (trx) => {
        await updateFlightPrimitiveWithConnection(trx, updateId, values);
        await persistEntityCustomFields(trx, {
          entityType: 'flight',
          entityId: String(updateId),
          values: customFields,
        });
      });
    } catch (e) {
      if (e instanceof CustomFieldValidationError) {
        return {
          success: false,
          type: 'error',
          message: e.message,
        };
      }
      return {
        success: false,
        type: 'error',
        message: 'Failed to update flight',
      };
    }

    return { success: true, message: 'Flight updated successfully' };
  }

  let flightId: number;
  try {
    flightId = await db.transaction().execute(async (trx) => {
      const createdFlightId = await createFlightPrimitiveWithConnection(
        trx,
        values,
      );
      await persistEntityCustomFields(trx, {
        entityType: 'flight',
        entityId: String(createdFlightId),
        values: customFields,
      });
      return createdFlightId;
    });
  } catch (e) {
    if (e instanceof CustomFieldValidationError) {
      return {
        success: false,
        type: 'error',
        message: e.message,
      };
    }
    return {
      success: false,
      type: 'error',
      message: 'Failed to add flight',
    };
  }

  return {
    success: true,
    message: 'Flight added',
    id: flightId,
  };
};

export const deleteFlight = async (id: number) => {
  return await db.deleteFrom('flight').where('id', '=', id).executeTakeFirst();
};

export const updateFlight = async (id: number, data: CreateFlight) => {
  return await updateFlightPrimitive(db, id, data);
};

const signature = (f: CreateFlight) => {
  const from = f.from?.id ?? null;
  const to = f.to?.id ?? null;
  return [
    f.date ?? '',
    from ?? '',
    to ?? '',
    f.flightNumber ?? '',
    f.aircraftReg ?? '',
    f.departure ?? '',
    f.arrival ?? '',
  ].join('|');
};

export const createManyFlights = async (
  data: CreateFlight[],
  userId: string,
  dedupe = true,
): Promise<{ insertedFlights: number; attachedSeats: number }> => {
  if (!dedupe) {
    const insertedFlights = data.length;
    const attachedSeats = data.reduce(
      (acc, f) => acc + (f.seats?.length ?? 0),
      0,
    );
    await createManyFlightsPrimitive(db, data);
    return { insertedFlights, attachedSeats };
  }

  // Deduplicate within incoming data
  const uniqueMap = new Map<string, CreateFlight>();
  for (const f of data) {
    const key = signature(f);
    if (!uniqueMap.has(key)) uniqueMap.set(key, f);
  }
  const uniqueFlights = Array.from(uniqueMap.values());

  if (uniqueFlights.length === 0)
    return { insertedFlights: 0, attachedSeats: 0 };

  // Gather candidate filters
  const dates = new Set(uniqueFlights.map((f) => f.date));
  const froms = new Set(
    uniqueFlights.map((f) => f.from?.id).filter((id): id is string => !!id),
  );
  const tos = new Set(
    uniqueFlights.map((f) => f.to?.id).filter((id): id is string => !!id),
  );

  // Fetch existing flights for candidate space
  let existingFlights: Flight[] = [];

  if (dates.size && froms.size && tos.size) {
    const listQuery = listFlightsQuery(userId);
    existingFlights = await listQuery
      .where('date', 'in', Array.from(dates))
      .where('fromId', 'in', Array.from(froms))
      .where('toId', 'in', Array.from(tos))
      .execute();
  }

  const existingBySig = new Map<string, number>();
  for (const ef of existingFlights) {
    const key = signature(ef);
    if (!existingBySig.has(key)) existingBySig.set(key, ef.id);
  }

  // Fetch user's existing seats among those flights
  const existingIds = Array.from(new Set(existingFlights.map((f) => f.id)));
  const userSeatByFlight = new Set<number>();
  if (existingIds.length) {
    const userSeats = await db
      .selectFrom('seat')
      .select(['flightId'])
      .where('userId', '=', userId)
      .where('flightId', 'in', existingIds)
      .execute();
    userSeats.forEach((s) => userSeatByFlight.add(s.flightId));
  }

  const flightsToInsert: CreateFlight[] = [];
  type SeatInsert = Insertable<DB['seat']>;
  const seatsToAttach: SeatInsert[] = [];

  for (const f of uniqueFlights) {
    const key = signature(f);
    const existingId = existingBySig.get(key);
    if (existingId) {
      // If user already has a seat on this flight, skip entirely
      if (userSeatByFlight.has(existingId)) {
        continue;
      }
      // Otherwise, attach incoming seats to existing flight
      for (const seat of f.seats) {
        seatsToAttach.push({
          flightId: existingId,
          userId: seat.userId,
          guestName: seat.guestName,
          seat: seat.seat,
          seatNumber: seat.seatNumber,
          seatClass: seat.seatClass,
        });
      }
      continue;
    }
    flightsToInsert.push(f);
  }

  // Insert new flights and their seats
  let insertedFlights = 0;
  if (flightsToInsert.length) {
    await createManyFlightsPrimitive(db, flightsToInsert);
    insertedFlights = flightsToInsert.length;
  }

  // Attach seats to existing flights (dedup seats per user/flight)
  let attachedSeats = 0;
  if (seatsToAttach.length) {
    const seatKey = (s: { flightId: number; userId: string | null }) =>
      `${s.flightId}|${s.userId ?? ''}`;
    const uniqueSeatsMap = new Map<string, (typeof seatsToAttach)[number]>();
    for (const s of seatsToAttach) {
      const k = seatKey(s);
      if (!uniqueSeatsMap.has(k)) uniqueSeatsMap.set(k, s);
    }
    const uniqueSeats = Array.from(uniqueSeatsMap.values());
    if (uniqueSeats.length) {
      await db.insertInto('seat').values(uniqueSeats).execute();
      attachedSeats = uniqueSeats.length;
    }
  }

  return { insertedFlights, attachedSeats };
};
