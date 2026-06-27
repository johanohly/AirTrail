import { z } from 'zod';

import { page } from '$app/state';
import type { PlatformOptions } from '$lib/components/modals/settings/pages/import-page';
import {
  FlightDatePrecisions,
  type Airline,
  type Airport,
  type CreateFlight,
} from '$lib/db/types';
import { api } from '$lib/trpc';
import { getAircraftByIcao, getAircraftByName } from '$lib/utils/data/aircraft';
import { getAirlineByIcao, getAirlineByName } from '$lib/utils/data/airlines';
import { getAirportByIcao } from '$lib/utils/data/airports/cache';
import { aircraftSchema } from '$lib/zod/aircraft';
import { airlineSchema } from '$lib/zod/airline';
import { flightAirportSchema } from '$lib/zod/airport';
import {
  flightOptionalInformationSchema,
  flightSeatInformationSchema,
} from '$lib/zod/flight';
import { usernameSchema } from '$lib/zod/user';
import { flightTrackInputSchema } from '$lib/track/schema';

const dateTimePrimitive = z
  .string()
  .datetime({ offset: true })
  .nullable()
  .optional();
const airportRefSchema = z.union([
  flightAirportSchema.omit({ id: true }),
  z.object({ code: z.string().max(4) }),
]);
const airlineRefSchema = airlineSchema.omit({ id: true }).nullable();
const aircraftRefSchema = aircraftSchema.omit({ id: true }).nullable();

const AirTrailFile = z.object({
  flights: z
    .object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      datePrecision: z.enum(FlightDatePrecisions).default('day'),
      from: airportRefSchema,
      to: airportRefSchema,
      departure: z
        .string()
        .datetime({ offset: true, message: 'Invalid datetime' })
        .nullable(),
      arrival: z
        .string()
        .datetime({ offset: true, message: 'Invalid datetime' })
        .nullable(),
      departureScheduled: dateTimePrimitive,
      arrivalScheduled: dateTimePrimitive,
      takeoffScheduled: dateTimePrimitive,
      takeoffActual: dateTimePrimitive,
      landingScheduled: dateTimePrimitive,
      landingActual: dateTimePrimitive,
      duration: z.number().int().positive().nullable(),
      airline: airlineRefSchema,
      aircraft: aircraftRefSchema,
      track: flightTrackInputSchema.nullable().optional(),
    })
    .merge(
      flightOptionalInformationSchema.omit({ airline: true, aircraft: true }),
    )
    .merge(flightSeatInformationSchema)
    .array()
    .min(1, 'At least one flight is required'),
  users: z
    .object({
      id: z.string().min(3),
      username: usernameSchema,
      displayName: z.string().min(3),
    })
    .array()
    .min(1, 'At least one user is required'),
});

type AirportRef = z.infer<typeof airportRefSchema>;
type AirlineRef = z.infer<typeof airlineRefSchema>;
type AircraftRef = z.infer<typeof aircraftRefSchema>;

const getAirportCode = (airport: AirportRef) =>
  'icao' in airport ? airport.icao : airport.code;

const getAirlineCode = (airline: AirlineRef) => airline?.icao ?? null;

const getAircraftCode = (aircraft: AircraftRef) => aircraft?.icao ?? null;

const getAirlineName = (airline: AirlineRef) => airline?.name ?? null;

const getAircraftName = (aircraft: AircraftRef) => aircraft?.name ?? null;

const resolveAirport = async (
  airport: AirportRef,
  airportMapping?: Record<string, Airport>,
) => {
  const code = getAirportCode(airport);
  return airportMapping?.[code] ?? (await getAirportByIcao(code));
};

const resolveAirline = async (
  airline: AirlineRef,
  airlineMapping?: Record<string, Airline>,
) => {
  if (!airline) return null;

  const code = getAirlineCode(airline);
  const name = getAirlineName(airline);
  if (code) {
    return airlineMapping?.[code] ?? (await getAirlineByIcao(code));
  }
  if (name) {
    return await getAirlineByName(name);
  }

  return null;
};

const resolveAircraft = async (aircraft: AircraftRef) => {
  if (!aircraft) return null;

  const code = getAircraftCode(aircraft);
  const name = getAircraftName(aircraft);
  if (code) return await getAircraftByIcao(code);
  if (name) return await getAircraftByName(name);

  return null;
};

export const processAirTrailFile = async (
  input: string,
  options: PlatformOptions,
) => {
  const user = page.data.user;
  if (!user) {
    throw new Error('User not found');
  }

  let parsed;
  try {
    parsed = JSON.parse(input);
  } catch (_) {
    throw new Error('Invalid JSON found in AirTrail file');
  }

  const result = AirTrailFile.safeParse(parsed);
  if (!result.success) {
    throw new Error(result.error.message);
  }

  const flights: CreateFlight[] = [];
  const data = result.data;
  const dataUsers = data.users.reduce<
    Record<
      string,
      {
        id: string;
        username: string;
        displayName: string;
      }
    >
  >((acc, user) => {
    acc[user.id] = user;
    return acc;
  }, {});
  const users = await api.user.list.query();

  const exportedUsers = data.users.map((exportedUser) => {
    const mappedUserId =
      options.userMapping?.[exportedUser.id] ??
      users.find((user) => user.username === exportedUser.username)?.id ??
      null;

    return {
      id: exportedUser.id,
      username: exportedUser.username,
      displayName: exportedUser.displayName,
      mappedUserId,
    };
  });

  const unknownAirports: Record<string, number[]> = {};
  const unknownAirlines: Record<string, number[]> = {};
  const unknownUsers: Record<string, number[]> = {};
  const addUnknownFlightIndex = (
    records: Record<string, number[]>,
    key: string,
    flightIndex: number,
  ) => {
    const flightIndexes = records[key] ?? [];
    records[key] = flightIndexes;
    flightIndexes.push(flightIndex);
  };
  for (const rawFlight of data.flights) {
    const flightIndex = flights.length;

    const seats = rawFlight.seats.map((seat) => {
      const dataUser = dataUsers?.[seat.userId ?? ''];
      const mappedUserId = dataUser
        ? exportedUsers.find((u) => u.id === dataUser.id)?.mappedUserId
        : null;
      const user = mappedUserId
        ? users.find((user) => user.id === mappedUserId)
        : null;

      if (dataUser && !user) {
        const key = `${dataUser.id}|${dataUser.username}|${dataUser.displayName}`;
        addUnknownFlightIndex(unknownUsers, key, flightIndex);
      }
      /*
      1. If the user is known, no guest name is needed.
      2. If the user is unknown, but the guest name is known, use the guest name.
      3. If the user is unknown and the guest name is unknown, use the provided display name (this could happen if the user is not in the database).
       */
      const guestName = user
        ? null
        : seat.guestName
          ? seat.guestName
          : dataUser
            ? dataUser.displayName
            : null;

      return {
        ...seat,
        userId: user?.id ?? null,
        guestName,
      };
    });

    // If exported with a different username, add the user to the list manually.
    if (
      !seats.some(
        (seat) =>
          users.find((usr) => usr.id === seat.userId)?.username ===
          user.username,
      )
    ) {
      seats.push({
        userId: user.id,
        guestName: null,
        seat: null,
        seatClass: null,
        seatNumber: null,
      });
    }

    const fromCode = getAirportCode(rawFlight.from);
    const toCode = getAirportCode(rawFlight.to);
    const airlineCode = getAirlineCode(rawFlight.airline);
    const from = await resolveAirport(rawFlight.from, options.airportMapping);
    const to = await resolveAirport(rawFlight.to, options.airportMapping);
    const airline = await resolveAirline(
      rawFlight.airline,
      options.airlineMapping,
    );
    const aircraft = await resolveAircraft(rawFlight.aircraft);

    if (!from) {
      addUnknownFlightIndex(unknownAirports, fromCode, flightIndex);
    }
    if (!to) {
      addUnknownFlightIndex(unknownAirports, toCode, flightIndex);
    }
    if (!airline && airlineCode) {
      addUnknownFlightIndex(unknownAirlines, airlineCode, flightIndex);
    }

    flights.push({
      ...rawFlight,
      departureScheduled: rawFlight.departureScheduled ?? null,
      arrivalScheduled: rawFlight.arrivalScheduled ?? null,
      takeoffScheduled: rawFlight.takeoffScheduled ?? null,
      takeoffActual: rawFlight.takeoffActual ?? null,
      landingScheduled: rawFlight.landingScheduled ?? null,
      landingActual: rawFlight.landingActual ?? null,
      departureTerminal: rawFlight.departureTerminal ?? null,
      departureGate: rawFlight.departureGate ?? null,
      arrivalTerminal: rawFlight.arrivalTerminal ?? null,
      arrivalGate: rawFlight.arrivalGate ?? null,
      from: from || null,
      to: to || null,
      airline,
      aircraft,
      track: rawFlight.track,
      seats,
    });
  }

  return {
    flights,
    unknownAirports,
    unknownAirlines,
    unknownUsers,
    exportedUsers,
  };
};
