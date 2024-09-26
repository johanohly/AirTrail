import { page } from '$app/stores';
import { get } from 'svelte/store';
import {
  flightAirportsSchema,
  flightOptionalInformationSchema,
  flightSeatInformationSchema,
} from '$lib/zod/flight';
import { z } from 'zod';
import type { CreateFlight } from '$lib/db/types';
import { api } from '$lib/trpc';

const AirTrailFile = z.object({
  flights: z
    .object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      departure: z.string().datetime('Invalid datetime').nullable(),
      arrival: z.string().datetime('Invalid datetime').nullable(),
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
  } catch (e) {
    return [];
  }

  const result = AirTrailFile.safeParse(parsed);
  if (!result.success) {
    return [];
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
      const guestName = user ? null : seat.guestName;

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

  return flights;
};
