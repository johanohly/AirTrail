import { z } from 'zod';

import { page } from '$app/state';
import type { PlatformOptions } from '$lib/components/modals/settings/pages/import-page';
import {
  type CreateFlight,
  FlightReasons,
  SeatClasses,
  SeatTypes,
} from '$lib/db/types';
import { api } from '$lib/trpc';

const AirTrailFile = z.object({
  flights: z
    .object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      from: z.object({
        code: z.string().max(4, 'Airport code is too long'),
      }),
      to: z.object({
        code: z.string().max(4, 'Airport code is too long'),
      }),
      departure: z
        .string()
        .datetime({ offset: true, message: 'Invalid datetime' })
        .nullable(),
      arrival: z
        .string()
        .datetime({ offset: true, message: 'Invalid datetime' })
        .nullable(),
      duration: z.number().int().positive().nullable(),
      airline: z.string().max(4, 'Airline is too long').nullable(),
      flightNumber: z.string().max(10, 'Flight number is too long').nullable(), // should cover all cases
      aircraft: z.string().max(4, 'Aircraft is too long').nullable(),
      aircraftReg: z
        .string()
        .max(10, 'Aircraft registration is too long')
        .nullable(),
      flightReason: z.enum(FlightReasons).nullable(),
      note: z.string().max(1000, 'Note is too long').nullable(),
      seats: z
        .object({
          userId: z.string().nullable(),
          guestName: z.string().max(50, 'Guest name is too long').nullable(),
          seat: z.enum(SeatTypes).nullable(),
          seatNumber: z.string().max(5, 'Seat number is too long').nullable(), // 12A-1 for example
          seatClass: z.enum(SeatClasses).nullable(),
        })
        .refine((data) => data.userId ?? data.guestName, {
          message: 'Select a user or add a guest name',
          path: ['userId'],
        })
        .array()
        .min(1, 'Add at least one seat')
        .refine((data) => data.some((seat) => seat.userId), {
          message: 'At least one seat must be assigned to a user',
        })
        .default([
          {
            userId: '<USER_ID>',
            guestName: null,
            seat: null,
            seatNumber: null,
            seatClass: null,
          },
        ]),
    })
    .array()
    .min(1, 'At least one flight is required'),
  users: z
    .object({
      id: z.string().min(3),
      username: z
        .string()
        .min(3, { message: 'Username must be at least 3 characters long' })
        .max(20, { message: 'Username must be at most 20 characters long' })
        .regex(/^\w+$/, {
          message:
            'Username can only contain letters, numbers, and underscores',
        }),
      displayName: z.string().min(3),
    })
    .array()
    .min(1, 'At least one user is required'),
});

export const processLegacyAirTrailFile = async (
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

  const unknownAirports: Record<string, number[]> = {};
  const unknownAirlines: Record<string, number[]> = {};
  for (const rawFlight of data.flights) {
    const seats = rawFlight.seats.map((seat) => {
      const dataUser = dataUsers?.[seat.userId ?? ''];
      const user = dataUser
        ? users.find((user) => user.username === dataUser?.username)
        : null;
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

    const mappedFrom = options.airportMapping?.[rawFlight.from.code];
    const mappedTo = options.airportMapping?.[rawFlight.to.code];
    const from =
      mappedFrom ?? (await api.airport.getFromIcao.query(rawFlight.from.code));
    const to =
      mappedTo ?? (await api.airport.getFromIcao.query(rawFlight.to.code));

    let airline = null;
    if (rawFlight.airline) {
      const mappedAirline = options.airlineMapping?.[rawFlight.airline];
      airline =
        mappedAirline || (await api.airline.getByIcao.query(rawFlight.airline));
    }

    const flightIndex = flights.length;

    if (!from) {
      if (!unknownAirports[rawFlight.from.code])
        unknownAirports[rawFlight.from.code] = [];
      unknownAirports[rawFlight.from.code].push(flightIndex);
    }
    if (!to) {
      if (!unknownAirports[rawFlight.to.code])
        unknownAirports[rawFlight.to.code] = [];
      unknownAirports[rawFlight.to.code].push(flightIndex);
    }
    if (!airline && rawFlight.airline) {
      if (!unknownAirlines[rawFlight.airline])
        unknownAirlines[rawFlight.airline] = [];
      unknownAirlines[rawFlight.airline].push(flightIndex);
    }

    flights.push({
      ...rawFlight,
      airline,
      aircraft: rawFlight.aircraft
        ? await api.aircraft.getByIcao.query(rawFlight.aircraft)
        : null,
      from: from || null,
      to: to || null,
      seats,
    });
  }

  return {
    flights,
    unknownAirports,
    unknownAirlines,
  };
};
