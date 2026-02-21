import { z } from 'zod';

import { FlightReasons, SeatClasses, SeatTypes } from '$lib/db/types';
import { flightAirportSchema } from '$lib/zod/airport';
import { aircraftSchema } from '$lib/zod/aircraft';
import { airlineSchema } from '$lib/zod/airline';

const regex24h = /^([01]?\d|2[0-3])(?::|\.|)[0-5]\d(?:\s?(?:am|pm))?$/i;
const regex12hLike = /^\d{1,2}(?::|\.|)\d{2}\s?(?:am|pm)$/i;
const regex12h = /^([1-9]|1[0-2])(?::|\.|)[0-5]\d\s?(?:am|pm)$/i;

const timePrimitive = z
  .string()
  .refine((value) => {
    // Always allow empty string (to allow the user to delete the input)
    if (value === '') return true;

    return regex24h.test(value);
  }, 'Invalid 24-hour format')
  .refine((value) => {
    // Skip 12-hour check if empty or not possibly 12-hour format (caught by the previous refine)
    if (value === '' || !regex12hLike.test(value)) return true;

    return regex12h.test(value);
  }, 'Invalid 12-hour format')
  .nullable();

const dateTimePrimitive = z.string().datetime({ offset: true });

export const flightAirportsSchema = z.object({
  from: flightAirportSchema
    .nullable()
    .default(null)
    .refine((value) => value !== null, 'Select a departure airport'),
  to: flightAirportSchema
    .nullable()
    .default(null)
    .refine((value) => value !== null, 'Select an arrival airport'),
});

export const flightDateTimeSchema = z.object({
  departure: z
    .string()
    .datetime({ offset: true, message: 'Select a departure date' })
    .nullable(),
  departureTime: timePrimitive,
  departureScheduled: dateTimePrimitive.nullable(),
  departureScheduledTime: timePrimitive,
  arrival: z
    .string()
    .datetime({ offset: true, message: 'Select an arrival date' })
    .nullable(),
  arrivalTime: timePrimitive,
  arrivalScheduled: dateTimePrimitive.nullable(),
  arrivalScheduledTime: timePrimitive,
  takeoffScheduled: dateTimePrimitive.nullable(),
  takeoffScheduledTime: timePrimitive,
  takeoffActual: dateTimePrimitive.nullable(),
  takeoffActualTime: timePrimitive,
  landingScheduled: dateTimePrimitive.nullable(),
  landingScheduledTime: timePrimitive,
  landingActual: dateTimePrimitive.nullable(),
  landingActualTime: timePrimitive,
});

export const flightSeatInformationSchema = z.object({
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
});

export const flightOptionalInformationSchema = z.object({
  id: z.number().optional(), // Only for editing an existing flight
  airline: airlineSchema.nullable(),
  flightNumber: z.string().max(10, 'Flight number is too long').nullable(), // should cover all cases
  aircraft: aircraftSchema.nullable(),
  aircraftReg: z
    .string()
    .max(10, 'Aircraft registration is too long')
    .nullable(),
  flightReason: z.enum(FlightReasons).nullable(),
  note: z.string().max(1000, 'Note is too long').nullable(),
  departureTerminal: z.string().max(10).nullable().optional(),
  departureGate: z.string().max(10).nullable().optional(),
  arrivalTerminal: z.string().max(10).nullable().optional(),
  arrivalGate: z.string().max(10).nullable().optional(),
});

export const flightCustomFieldsSchema = z.object({
  // Map of custom field key/fieldId -> value.
  customFields: z.record(z.string(), z.unknown()).default({}),
});

export const flightSchema = flightAirportsSchema
  .merge(flightDateTimeSchema)
  .merge(flightOptionalInformationSchema)
  .merge(flightSeatInformationSchema)
  .merge(flightCustomFieldsSchema);
