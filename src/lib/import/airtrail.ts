import { get } from 'svelte/store';
import { z } from 'zod';

import { page } from '$app/stores';
import type { CreateFlight } from '$lib/db/types';
import { api } from '$lib/trpc';
import {
  flightAirportsSchema,
  flightOptionalInformationSchema,
  flightSeatInformationSchema,
} from '$lib/zod/flight';

const AirTrailFile = z.object({
  flights: z
    .object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      departure: z
        .string()
        .datetime({ offset: true, message: 'Invalid datetime' })
        .nullable(),
      arrival: z
        .string()
        .datetime({ offset: true, message: 'Invalid datetime' })
        .nullable(),
      duration: z.number().int().positive().nullable(),
    })
    .merge(flightAirportsSchema)
    .merge(flightOptionalInformationSchema)
    .merge(flightSeatInformationSchema)
    .array()
    .min(1, 'At least one flight is required'),
  users: z
    .object({
      id: z.string().min(3),
      username: z
        .string()
        .min(3, { message: 'Username must be at least 3 characters long' })
        .max(20, { message: 'Username must be at most 20 characters long' })
        .regex(/^[a-zA-Z0-9_]+$/, {
          message:
            'Username can only contain letters, numbers, and underscores',
        }),
      displayName: z.string().min(3),
    })
    .array()
    .min(1, 'At least one user is required'),
});

export const processAirTrailFile = async (input: string) => {
  const user = get(page).data.user;
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

  data.flights.forEach((flight) => {
    const seats = flight.seats.map((seat) => {
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

    flights.push({
      ...flight,
      seats,
    });
  });

  return {
    flights,
    unknownAirports: [],
  };
};
