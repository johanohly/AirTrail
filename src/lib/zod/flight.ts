import { z } from 'zod';
import { FlightReasons, SeatClasses, SeatTypes } from '$lib/db/types';

// |^$ is for empty string in the case where the user deletes the input
const timeRegex24 = /^([01]?[0-9]|2[0-3]):[0-5][0-9](?:\s?(?:am|pm))?$|^$/;
const timeRegex12 = /^\d{1,2}:\d{2}\s?(?:am|pm)$/;

export const flightAirportsSchema = z.object({
  from: z.string().min(1, 'Select an origin'),
  to: z.string().min(1, 'Select a destination'),
});

export const flightDateTimeSchema = z.object({
  departure: z
    .string()
    .datetime('Select a departure date')
    .optional()
    .refine((value) => value !== undefined, 'Select a departure date'),
  departureTime: z
    .string()
    .refine((value) => timeRegex24.test(value), 'Invalid 24-hour format')
    .refine((value) => {
      if (timeRegex12.test(value)) {
        return /^([1-9]|1[0-2]):[0-5][0-9]\s?(?:am|pm)$/.test(value);
      }
      return true; // If it's not in 12-hour format, just return true (it'll be caught by the previous refine)
    }, 'Invalid 12-hour format')
    .optional(),
  arrival: z.string().datetime('Select an arrival date').optional(),
  arrivalTime: z
    .string()
    .refine((value) => timeRegex24.test(value), 'Invalid 24-hour format')
    .refine((value) => {
      if (timeRegex12.test(value)) {
        return /^([1-9]|1[0-2]):[0-5][0-9]\s?(?:am|pm)$/.test(value);
      }
      return true; // If it's not in 12-hour format, just return true (it'll be caught by the previous refine)
    }, 'Invalid 12-hour format')
    .optional(),
});

export const flightOptionalInformationSchema = z.object({
  seat: z.enum(SeatTypes).optional(),
  seatNumber: z.string().max(5, 'Seat number is too long').optional(), // 12A-1 for example
  seatClass: z.enum(SeatClasses).optional(),

  airline: z.string().max(4, 'Airline is too long').optional(), // ICAO code
  flightNumber: z.string().max(10, 'Flight number is too long').optional(), // should cover all cases
  aircraft: z.string().max(4, 'Aircraft is too long').optional(), // ICAO type code
  aircraftReg: z
    .string()
    .max(10, 'Aircraft registration is too long')
    .optional(),
  flightReason: z.enum(FlightReasons).optional(),
  note: z.string().max(1000, 'Note is too long').optional(),
});

export const flightSchema = flightAirportsSchema
  .merge(flightDateTimeSchema)
  .merge(flightOptionalInformationSchema);
