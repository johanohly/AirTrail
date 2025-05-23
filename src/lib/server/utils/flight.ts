import type { TZDate } from '@date-fns/tz';
import { differenceInSeconds, format, isBefore, parseISO } from 'date-fns';
import { z } from 'zod';

import { db } from '$lib/db';
import {
  createFlightPrimitive,
  createManyFlightsPrimitive,
  getFlightPrimitive,
  listFlightPrimitive,
  updateFlightPrimitive,
} from '$lib/db/queries';
import type { CreateFlight, User } from '$lib/db/types';
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

  const from = data.from;
  const to = data.to;

  const departureDate = parseISO(data.departure);
  if (isBeforeEpoch(departureDate)) {
    // Y2K38
    return pathError('departure', 'Too far in the past');
  }

  let departure: TZDate | undefined;
  try {
    departure = data.departureTime
      ? mergeTimeWithDate(data.departure, data.departureTime, from.tz)
      : undefined;
  } catch {
    return pathError('departureTime', 'Invalid time format');
  }

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

  if (arrival && departure && isBefore(arrival, departure)) {
    return pathError('arrival', 'Arrival must be after departure');
  }

  let duration: number | null = null;
  if (departure && arrival) {
    duration = differenceInSeconds(arrival, departure);
  } else if (from.code !== to.code) {
    // if the airports are the same, the duration can't be calculated
    const fromLonLat = { lon: from.lon, lat: from.lat };
    const toLonLat = { lon: to.lon, lat: to.lat };
    duration = estimateFlightDuration(
      distanceBetween(fromLonLat, toLonLat) / 1000,
    );
  }

  const { flightNumber, aircraft, aircraftReg, airline, flightReason, note } =
    data;

  const values = {
    from,
    to,
    duration,
    departure: departure ? toUtc(departure).toISOString() : null,
    arrival: arrival ? toUtc(arrival).toISOString() : null,
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
      await updateFlight(updateId, values);
    } catch {
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
    flightId = await createFlight(values);
  } catch (_) {
    return {
      success: false,
      type: 'error',
      message: 'Failed to add flight',
    };
  }

  return {
    success: true,
    message: 'Flight added successfully',
    id: flightId,
  };
};

export const deleteFlight = async (id: number) => {
  return await db.deleteFrom('flight').where('id', '=', id).executeTakeFirst();
};

export const updateFlight = async (id: number, data: CreateFlight) => {
  return await updateFlightPrimitive(db, id, data);
};

export const createManyFlights = async (data: CreateFlight[]) => {
  await createManyFlightsPrimitive(db, data);
};
