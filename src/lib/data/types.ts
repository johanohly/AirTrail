import { z } from 'zod';

export interface Airline {
  id: string;
  name: string;
  icao: string | null;
  iata: string | null;
  icon: string | null;
  defunct: boolean | null;
}

export interface Aircraft {
  id: string;
  name: string;
  icao: string | null;
}

export const airlineDataSchema = z.object({
  id: z.string().min(1, 'Airline ID is required'),
  name: z.string().min(1, 'Airline name is required'),
  icao: z.string().nullable(),
  iata: z.string().nullable(),
  icon: z.string().nullable(),
  defunct: z.boolean().nullable(),
});

export const aircraftDataSchema = z.object({
  id: z.string().min(1, 'Aircraft ID is required'),
  name: z.string().min(1, 'Aircraft name is required'),
  icao: z.string().nullable(),
});

export const airlinesDataSchema = z.array(airlineDataSchema);
export const aircraftListDataSchema = z.array(aircraftDataSchema);
