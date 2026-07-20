import type { TZDate } from '@date-fns/tz';
import { differenceInSeconds, isBefore, parseISO } from 'date-fns';
import { type Insertable, sql } from 'kysely';
import { z } from 'zod';

import { db } from '$lib/db';
import {
  createFlightPrimitive,
  createFlightPrimitiveWithConnection,
  createManyFlightsPrimitive,
  getFlightPrimitive,
  listAllFlightsPrimitive,
  listFlightBaseQuery,
  listFlightPrimitive,
  updateFlightPrimitive,
  updateFlightPrimitiveWithConnection,
  upsertFlightTrackPrimitiveWithConnection,
} from '$lib/db/queries';
import type { DB } from '$lib/db/schema';
import type { CreateFlight, Flight, User } from '$lib/db/types';
import {
  CustomFieldValidationError,
  persistEntityCustomFields,
} from '$lib/server/utils/custom-fields';
import {
  getMissingImportPassengers,
  type FlightImportMode,
} from '$lib/server/utils/flight-import';
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

const assertDateOrder = (
  start: Date | null | undefined,
  end: Date | null | undefined,
): boolean => {
  if (!start || !end) return true;
  return !isBefore(end, start);
};

export const validateFlightDates = (flight: CreateFlight): string | null => {
  const pairs: [string | null, string | null, string][] = [
    [flight.departure, flight.arrival, 'Arrival must be after departure'],
    [
      flight.departureScheduled,
      flight.arrivalScheduled,
      'Scheduled arrival must be after scheduled departure',
    ],
    [
      flight.takeoffScheduled,
      flight.landingScheduled,
      'Scheduled landing must be after scheduled takeoff',
    ],
    [
      flight.takeoffActual,
      flight.landingActual,
      'Actual landing must be after actual takeoff',
    ],
  ];

  for (const [start, end, message] of pairs) {
    if (
      !assertDateOrder(
        start ? parseISO(start) : null,
        end ? parseISO(end) : null,
      )
    ) {
      return message;
    }
  }

  return null;
};

export const listFlightsQuery = (userId: string) => {
  return listFlightBaseQuery(db, userId);
};

export const listFlights = async (userId: string) => {
  return await listFlightPrimitive(db, userId);
};

export const listAllFlights = async () => {
  return await listAllFlightsPrimitive(db);
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
  options?: {
    bypassPassengerCheck?: boolean;
  },
): Promise<ErrorActionResult & { id?: number }> => {
  const pathError = (path: string, message: string): ErrorActionResult => {
    return { success: false, type: 'path', path, message };
  };

  const toCanonicalDate = (iso: string) => iso.slice(0, 10);

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

  const saveFlightValues = async (
    values: CreateFlight,
    customFields: Record<string, unknown>,
  ): Promise<ErrorActionResult & { id?: number }> => {
    const updateId = data.id;
    if (updateId) {
      const flight = await getFlight(updateId);
      if (
        !flight ||
        (!options?.bypassPassengerCheck &&
          !flight.passengers.some((passenger) => passenger.userId === user.id))
      ) {
        return {
          success: false,
          type: 'httpError',
          status: 404,
          message: 'Flight not found or you are not a passenger on this flight',
        };
      }

      try {
        await db.transaction().execute(async (trx) => {
          const persistedPassengers = await updateFlightPrimitiveWithConnection(
            trx,
            updateId,
            values,
          );
          await persistEntityCustomFields(trx, {
            entityType: 'flight',
            entityId: String(updateId),
            values: customFields,
          });
          for (const passenger of persistedPassengers) {
            await persistEntityCustomFields(trx, {
              entityType: 'flight_passenger',
              entityId: String(passenger.id),
              values: passenger.input.customFields,
            });
          }
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
        const created = await createFlightPrimitiveWithConnection(trx, values);
        await persistEntityCustomFields(trx, {
          entityType: 'flight',
          entityId: String(created.flightId),
          values: customFields,
        });
        for (const passenger of created.passengers) {
          await persistEntityCustomFields(trx, {
            entityType: 'flight_passenger',
            entityId: String(passenger.id),
            values: passenger.input.customFields,
          });
        }
        return created.flightId;
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

  const from = data.from;
  const to = data.to;

  const {
    datePrecision,
    flightNumber,
    aircraft,
    aircraftReg,
    airline,
    note,
    departureTerminal,
    departureGate,
    arrivalTerminal,
    arrivalGate,
    customFields = {},
    track,
  } = data;

  if (data.datePrecision !== 'day') {
    if (!data.departure) {
      return pathError('departure', 'Enter a 4-digit departure year');
    }

    const departureDate = parseISO(data.departure);
    if (isBeforeEpoch(departureDate)) {
      return pathError('departure', 'Too far in the past');
    }

    let duration: number | null = null;
    if (from.id !== to.id) {
      const fromLonLat = { lon: from.lon, lat: from.lat };
      const toLonLat = { lon: to.lon, lat: to.lat };
      duration = estimateFlightDuration(
        distanceBetween(fromLonLat, toLonLat) / 1000,
      );
    }

    const values = {
      from,
      to,
      duration,
      departure: data.departure,
      arrival: null,
      departureScheduled: null,
      arrivalScheduled: null,
      takeoffScheduled: null,
      takeoffActual: null,
      landingScheduled: null,
      landingActual: null,
      departureTerminal: departureTerminal ?? null,
      departureGate: departureGate ?? null,
      arrivalTerminal: arrivalTerminal ?? null,
      arrivalGate: arrivalGate ?? null,
      date: toCanonicalDate(data.departure),
      datePrecision,
      flightNumber,
      aircraft,
      aircraftReg,
      airline,
      note,
      passengers: data.passengers,
      track,
    };

    return await saveFlightValues(values, customFields);
  }

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

  if (!assertDateOrder(departure, arrival)) {
    return pathError('arrival', 'Arrival must be after departure');
  }

  if (!assertDateOrder(departureScheduled, arrivalScheduled)) {
    return pathError(
      'arrivalScheduled',
      'Scheduled arrival must be after scheduled departure',
    );
  }

  if (!assertDateOrder(takeoffScheduled, landingScheduled)) {
    return pathError(
      'landingScheduled',
      'Scheduled landing must be after scheduled takeoff',
    );
  }

  if (!assertDateOrder(takeoffActual, landingActual)) {
    return pathError(
      'landingActual',
      'Actual landing must be after actual takeoff',
    );
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
    date: toCanonicalDate(primaryDepartureDate!),
    datePrecision,
    flightNumber,
    aircraft,
    aircraftReg,
    airline,
    note,
    passengers: data.passengers,
    track,
  };

  return await saveFlightValues(values, customFields);
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
    f.datePrecision ?? 'day',
    from ?? '',
    to ?? '',
    f.flightNumber ?? '',
    f.aircraftReg ?? '',
    f.departure ?? '',
    f.arrival ?? '',
  ].join('|');
};

/**
 * Save flights produced by an importer. AirTrail backup custom fields are
 * export-only metadata and are intentionally not restored here.
 */
export const createManyFlights = async (
  data: CreateFlight[],
  userId: string,
  dedupe = true,
  mode: FlightImportMode = 'personal',
): Promise<{ insertedFlights: number; attachedPassengers: number }> => {
  if (!dedupe) {
    const insertedFlights = data.length;
    const attachedPassengers = data.reduce(
      (acc, f) => acc + (f.passengers?.length ?? 0),
      0,
    );
    await createManyFlightsPrimitive(db, data);
    return { insertedFlights, attachedPassengers };
  }

  // Deduplicate within incoming data
  const uniqueMap = new Map<string, CreateFlight>();
  for (const f of data) {
    const key = signature(f);
    if (!uniqueMap.has(key)) uniqueMap.set(key, f);
  }
  const uniqueFlights = Array.from(uniqueMap.values());

  if (uniqueFlights.length === 0)
    return { insertedFlights: 0, attachedPassengers: 0 };

  // Gather candidate filters
  const dates = new Set(uniqueFlights.map((f) => f.date));
  const froms = new Set(
    uniqueFlights.map((f) => f.from?.id).filter((id): id is number => !!id),
  );
  const tos = new Set(
    uniqueFlights.map((f) => f.to?.id).filter((id): id is number => !!id),
  );

  // Fetch existing flights for candidate space
  let existingFlights: Flight[] = [];

  if (dates.size && froms.size && tos.size) {
    const listQuery =
      mode === 'restore' ? listFlightBaseQuery(db) : listFlightsQuery(userId);
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

  const userPassengerByFlight = new Set<number>();
  const existingPassengersByFlight = new Map<
    number,
    Flight['passengers'][number][]
  >();
  for (const flight of existingFlights) {
    existingPassengersByFlight.set(flight.id, flight.passengers);
    if (flight.passengers.some((passenger) => passenger.userId === userId)) {
      userPassengerByFlight.add(flight.id);
    }
  }

  const flightsToInsert: CreateFlight[] = [];
  type PassengerInsert = Insertable<DB['flightPassenger']>;
  const passengersToAttach: PassengerInsert[] = [];
  const tracksToUpsert: Array<{
    flightId: number;
    track: NonNullable<CreateFlight['track']>;
  }> = [];

  for (const f of uniqueFlights) {
    const key = signature(f);
    const existingId = existingBySig.get(key);
    if (existingId) {
      if (f.track) {
        tracksToUpsert.push({ flightId: existingId, track: f.track });
      }

      // Personal imports only deduplicate flights already owned by the importer.
      if (mode === 'personal' && userPassengerByFlight.has(existingId)) {
        continue;
      }

      const missingPassengers = getMissingImportPassengers(
        existingPassengersByFlight.get(existingId) ?? [],
        f.passengers,
      );
      for (const passenger of missingPassengers) {
        passengersToAttach.push({
          flightId: existingId,
          userId: passenger.userId,
          guestName: passenger.guestName,
          seat: passenger.seat,
          seatNumber: passenger.seatNumber,
          seatClass: passenger.seatClass,
          flightReason: passenger.flightReason,
        });
      }
      continue;
    }
    flightsToInsert.push(f);
  }

  // Insert new flights and their passengers
  let insertedFlights = 0;
  if (flightsToInsert.length) {
    await createManyFlightsPrimitive(db, flightsToInsert);
    insertedFlights = flightsToInsert.length;
  }

  // Attach passengers to existing flights.
  let attachedPassengers = 0;
  if (passengersToAttach.length || tracksToUpsert.length) {
    await db.transaction().execute(async (trx) => {
      for (const { flightId, track } of tracksToUpsert) {
        await upsertFlightTrackPrimitiveWithConnection(trx, flightId, track);
      }

      if (passengersToAttach.length) {
        await trx
          .insertInto('flightPassenger')
          .values(passengersToAttach)
          .execute();
        attachedPassengers = passengersToAttach.length;
      }
    });
  }

  return { insertedFlights, attachedPassengers };
};
