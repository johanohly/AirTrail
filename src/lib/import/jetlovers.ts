import { z } from 'zod';

import { page } from '$app/state';
import type { PlatformOptions } from '$lib/components/modals/settings/pages/import-page';
import type { CreateFlight, FlightPassenger } from '$lib/db/types';
import { parseCsv } from '$lib/utils';
import { getAircraftByName } from '$lib/utils/data/aircraft';
import {
  getAirlineByIata,
  getAirlineByIcao,
  getAirlineByName,
} from '$lib/utils/data/airlines';
import { getAirportByIata } from '$lib/utils/data/airports/cache';

const nullTransformer = (value: string) => {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const JetLoversFlight = z.object({
  id: z.string().transform(nullTransformer),
  date: z.string().regex(dateRegex),
  from: z.string(),
  to: z.string(),
  miles: z.string().transform(nullTransformer),
  airline: z.string().transform(nullTransformer),
  flightnum: z.string().transform(nullTransformer),
  aircraft: z.string().transform(nullTransformer),
  aircraft_reg: z.string().transform(nullTransformer),
  class: z.string().transform(nullTransformer),
  reason: z.string().transform(nullTransformer),
  seat_type: z.string().transform(nullTransformer),
  seat: z.string().transform(nullTransformer),
});

const JETLOVERS_SEAT_TYPE_MAP: Record<string, FlightPassenger['seat']> = {
  W: 'window',
  A: 'aisle',
  M: 'middle',
};
const JETLOVERS_SEAT_CLASS_MAP: Record<string, FlightPassenger['seatClass']> = {
  F: 'first',
  C: 'business',
  B: 'business',
  P: 'economy+',
  Y: 'economy',
};
const JETLOVERS_FLIGHT_REASON_MAP: Record<
  string,
  NonNullable<CreateFlight['flightReason']>
> = {
  B: 'business',
  L: 'leisure',
  C: 'crew',
  O: 'other',
};

const mapNullableCode = <T>(map: Record<string, T>, value: string | null) => {
  if (!value) return null;
  return map[value.trim().toUpperCase()] ?? null;
};

const mapSeatType = (seatType: string | null): FlightPassenger['seat'] => {
  return mapNullableCode(JETLOVERS_SEAT_TYPE_MAP, seatType);
};

const mapSeatClass = (
  seatClass: string | null,
): FlightPassenger['seatClass'] => {
  return mapNullableCode(JETLOVERS_SEAT_CLASS_MAP, seatClass);
};

const mapFlightReason = (
  reason: string | null,
): CreateFlight['flightReason'] => {
  return mapNullableCode(JETLOVERS_FLIGHT_REASON_MAP, reason);
};

const extractAirlineCodeFromFlightNumber = (flightNumber: string | null) => {
  if (!flightNumber) return null;
  return (
    flightNumber.match(/^([A-Za-z]{2,3})\*?\d/)?.[1]?.toUpperCase() ?? null
  );
};

const lookupAirline = async (
  row: z.infer<typeof JetLoversFlight>,
  options: PlatformOptions,
) => {
  const name = row.airline?.trim() || null;
  const flightNumberCode = options.airlineFromFlightNumber
    ? extractAirlineCodeFromFlightNumber(row.flightnum)
    : null;
  const mappingKey = name ?? flightNumberCode;

  if (mappingKey && options.airlineMapping?.[mappingKey]) {
    return {
      airline: options.airlineMapping[mappingKey],
      airlineKey: mappingKey,
    };
  }

  let airline = name ? await getAirlineByName(name) : null;
  airline ??= flightNumberCode
    ? ((await getAirlineByIata(flightNumberCode)) ??
      (await getAirlineByIcao(flightNumberCode)))
    : null;

  return { airline, airlineKey: mappingKey };
};

export const processJetLoversFile = async (
  input: string,
  options: PlatformOptions,
) => {
  const userId = page.data.user?.id;
  if (!userId) {
    throw new Error('User not found');
  }

  const { rows: data, skipped } = parseCsv(input, JetLoversFlight);
  if (data.length === 0) {
    return {
      flights: [],
      unknownAirports: {},
      unknownAirlines: {},
      skippedRows: skipped.length,
    };
  }

  const flights: CreateFlight[] = [];
  const unknownAirports: Record<string, number[]> = {};
  const unknownAirlines: Record<string, number[]> = {};

  for (const row of data) {
    const fromCode = row.from.trim().toUpperCase();
    const toCode = row.to.trim().toUpperCase();

    const mappedFrom = options.airportMapping?.[fromCode];
    const mappedTo = options.airportMapping?.[toCode];
    const from = mappedFrom ?? (await getAirportByIata(fromCode));
    const to = mappedTo ?? (await getAirportByIata(toCode));

    const { airline, airlineKey } = await lookupAirline(row, options);
    const aircraft = row.aircraft
      ? await getAircraftByName(row.aircraft)
      : null;
    const flightNumber = row.flightnum?.replace('*', '') ?? null;
    const flightIndex = flights.length;

    if (!from) {
      unknownAirports[fromCode] ??= [];
      unknownAirports[fromCode].push(flightIndex);
    }
    if (!to) {
      unknownAirports[toCode] ??= [];
      unknownAirports[toCode].push(flightIndex);
    }
    if (!airline && airlineKey) {
      unknownAirlines[airlineKey] ??= [];
      unknownAirlines[airlineKey].push(flightIndex);
    }

    flights.push({
      date: row.date,
      from: from || null,
      to: to || null,
      departure: null,
      arrival: null,
      departureScheduled: null,
      arrivalScheduled: null,
      takeoffScheduled: null,
      takeoffActual: null,
      landingScheduled: null,
      landingActual: null,
      datePrecision: 'day',
      departureTerminal: null,
      departureGate: null,
      arrivalTerminal: null,
      arrivalGate: null,
      duration: null,
      flightNumber: flightNumber ? flightNumber.substring(0, 10) : null,
      note: null,
      airline,
      aircraft,
      aircraftReg: row.aircraft_reg ? row.aircraft_reg.substring(0, 10) : null,
      flightReason: mapFlightReason(row.reason),
      passengers: [
        {
          userId,
          seat: mapSeatType(row.seat_type),
          seatClass: mapSeatClass(row.class),
          seatNumber: row.seat ? row.seat.substring(0, 5) : null,
          guestName: null,
        },
      ],
    });
  }

  return {
    flights,
    unknownAirports,
    unknownAirlines,
    skippedRows: skipped.length,
  };
};
