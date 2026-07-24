import { z } from 'zod';

import { page } from '$app/state';
import type { CreateFlight, FlightPassenger } from '$lib/db/types';
import type { PlatformOptions } from '$lib/import/model';
import { getAircraftByIcao } from '$lib/utils/data/aircraft';
import { getAirlineByIata } from '$lib/utils/data/airlines';
import { getAirportByIata } from '$lib/utils/data/airports/cache';

// Miles & More's API returns fixed-width fields padded with trailing spaces
// (e.g. "LX   ", "320  "), and older records may omit fields entirely, so
// every optional string field needs trimming and nullish handling.
const trimmed = z
  .string()
  .nullish()
  .transform((v) => (v && v.trim() ? v.trim() : null));

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const MilesAndMoreSegment = z.object({
  DepartureDate: z.string().regex(dateRegex, 'Invalid DepartureDate'),
  ArrivalDate: z.string().regex(dateRegex, 'Invalid ArrivalDate').nullish(),
  OriginAirportCode: trimmed,
  DestinationAirportCode: trimmed,
  AirlineDesignatorCode: trimmed,
  FlightNumber: z.number().int().nullish(),
  CompartmentClass: trimmed,
  AircraftCode: trimmed,
  TimeOnPlane: z.number().int().nullish(),
  DepartureTime: z.string().nullish(),
  ArrivalTime: z.string().nullish(),
  PnrrecordLocator: trimmed,
  StatusMiles: z.number().nullish(),
  StatusPoints: z.number().nullish(),
  GupPoints: z.number().nullish(),
  HonPoints: z.number().nullish(),
  Honmiles: z.number().nullish(),
  AwardMiles: z.number().nullish(),
});

const MilesAndMoreFile = z.object({
  SegmentListResponses: MilesAndMoreSegment.array(),
});

type MilesAndMoreSegment = z.infer<typeof MilesAndMoreSegment>;

// Miles & More's CompartmentClass is a single-letter booking/fare class, not
// a standardized cabin class. This is a best-effort heuristic based on
// common Lufthansa Group conventions and may not hold for every operating
// carrier in the export.
const COMPARTMENT_CLASS_MAP: Record<string, FlightPassenger['seatClass']> = {
  F: 'first',
  A: 'first',
  C: 'business',
  J: 'business',
  D: 'business',
  Z: 'business',
  P: 'business',
  W: 'economy+',
  E: 'economy+',
  G: 'economy+',
  N: 'economy+',
  M: 'economy',
  Y: 'economy',
  B: 'economy',
  H: 'economy',
  K: 'economy',
  L: 'economy',
  Q: 'economy',
  T: 'economy',
  V: 'economy',
  S: 'economy',
  O: 'economy',
};

const mapCompartmentClass = (
  compartmentClass: string | null,
): FlightPassenger['seatClass'] => {
  if (!compartmentClass) return null;
  const mapped = COMPARTMENT_CLASS_MAP[compartmentClass.toUpperCase()];
  if (!mapped) {
    console.warn(
      `Miles & More import: unknown compartment class code "${compartmentClass}", leaving seat class unset`,
    );
    return null;
  }
  return mapped;
};

// AirTrail's aircraft table is keyed by ICAO type code, but Miles & More
// only provides IATA type codes. This is a best-effort static mapping
// covering the Lufthansa Group / Star Alliance fleet types most commonly
// seen in Miles & More exports; codes that aren't in this table are left
// unmapped (aircraft stays null) with a console warning. Deliberately
// excluded: bare generic codes like "757"/"767"/"787" that don't specify
// a variant (e.g. 767-300 vs 767-400) — guessing one would silently assign
// a possibly-wrong aircraft, so these are left for manual user mapping.
const IATA_TO_ICAO_AIRCRAFT: Record<string, string> = {
  // Airbus narrowbody
  '319': 'A319',
  '320': 'A320',
  '321': 'A321',
  '32A': 'A320',
  '32B': 'A321',
  '32N': 'A20N',
  '32Q': 'A21N',
  '31X': 'A319',
  // Airbus widebody
  '332': 'A332',
  '333': 'A333',
  '338': 'A338',
  '339': 'A339',
  '343': 'A343',
  '345': 'A345',
  '346': 'A346',
  '359': 'A359',
  '35K': 'A35K',
  '388': 'A388',
  // Airbus A220 (formerly Bombardier CSeries)
  '221': 'BCS1',
  '223': 'BCS3',
  CS1: 'BCS1',
  CS3: 'BCS3',
  // Boeing narrowbody
  '73G': 'B737',
  '738': 'B738',
  '739': 'B739',
  '7M8': 'B38M',
  '7M9': 'B39M',
  // Boeing widebody
  '744': 'B744',
  '748': 'B748',
  '74H': 'B748',
  '74Y': 'B74F',
  '763': 'B763',
  '764': 'B764',
  '76W': 'B763',
  '772': 'B772',
  '773': 'B773',
  '77W': 'B77W',
  '77L': 'B77L',
  '788': 'B788',
  '789': 'B789',
  // Embraer
  '190': 'E190',
  '195': 'E195',
  '290': 'E290',
  '295': 'E295',
  E90: 'E190',
  E95: 'E195',
  // Bombardier / regional
  CR9: 'CRJ9',
  CR7: 'CRJ7',
  CRJ: 'CRJ2',
  DH4: 'DH8D',
  AT7: 'AT76',
  AT5: 'AT45',
};

const resolveAircraft = async (
  aircraftCode: string | null,
  options: PlatformOptions,
) => {
  if (!aircraftCode) return { aircraft: null, mappingKey: null };
  const mappingKey = aircraftCode.toUpperCase();

  if (options.aircraftMapping?.[mappingKey]) {
    return { aircraft: options.aircraftMapping[mappingKey], mappingKey };
  }

  const icao = IATA_TO_ICAO_AIRCRAFT[mappingKey];
  if (!icao) {
    console.warn(
      `Miles & More import: unmapped aircraft type code "${aircraftCode}", leaving aircraft unset`,
    );
    return { aircraft: null, mappingKey };
  }
  return { aircraft: (await getAircraftByIcao(icao)) ?? null, mappingKey };
};

const buildNote = (segment: MilesAndMoreSegment): string | null => {
  const parts: string[] = [];
  if (segment.PnrrecordLocator) {
    parts.push(`PNR ${segment.PnrrecordLocator}`);
  }
  if (segment.AwardMiles) {
    parts.push(`${segment.AwardMiles} award miles`);
  }
  if (segment.StatusMiles) {
    parts.push(`${segment.StatusMiles} status miles`);
  }
  if (segment.StatusPoints) {
    parts.push(`${segment.StatusPoints} status points`);
  }
  if (segment.GupPoints) {
    parts.push(`${segment.GupPoints} GUP points`);
  }
  if (segment.HonPoints) {
    parts.push(`${segment.HonPoints} HON points`);
  }
  if (segment.Honmiles) {
    parts.push(`${segment.Honmiles} HON miles`);
  }
  if (parts.length === 0) return null;
  return `Miles & More: ${parts.join(', ')}`;
};

export const processMilesAndMoreFile = async (
  input: string,
  options: PlatformOptions,
) => {
  const userId = page.data.user?.id;
  if (!userId) {
    throw new Error('User not found');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (_) {
    throw new Error('Invalid JSON found in Miles & More file');
  }

  const result = MilesAndMoreFile.safeParse(parsed);
  if (!result.success) {
    throw new Error(result.error.message);
  }

  const segments = result.data.SegmentListResponses;

  const flights: CreateFlight[] = [];
  const unknownAirports: Record<string, number[]> = {};
  const unknownAirlines: Record<string, number[]> = {};
  const unknownAircraft: Record<string, number[]> = {};
  let skippedRows = 0;

  for (const segment of segments) {
    if (
      !segment.OriginAirportCode ||
      !segment.DestinationAirportCode ||
      !segment.AirlineDesignatorCode ||
      segment.FlightNumber == null
    ) {
      skippedRows++;
      continue;
    }

    const mappedFrom = options.airportMapping?.[segment.OriginAirportCode];
    const mappedTo = options.airportMapping?.[segment.DestinationAirportCode];
    const from =
      mappedFrom ?? (await getAirportByIata(segment.OriginAirportCode));
    const to =
      mappedTo ?? (await getAirportByIata(segment.DestinationAirportCode));

    const mappedAirline =
      options.airlineMapping?.[segment.AirlineDesignatorCode];
    const airline =
      mappedAirline ?? (await getAirlineByIata(segment.AirlineDesignatorCode));

    const { aircraft, mappingKey: aircraftKey } = await resolveAircraft(
      segment.AircraftCode,
      options,
    );

    let departure = segment.DepartureTime
      ? new Date(segment.DepartureTime)
      : null;
    let arrival = segment.ArrivalTime ? new Date(segment.ArrivalTime) : null;
    if (departure && isNaN(departure.getTime())) departure = null;
    if (arrival && isNaN(arrival.getTime())) arrival = null;

    // Data inconsistency: an arrival strictly before departure can't be
    // reconstructed reliably (unlike CSV importers that build times from a
    // local date + time-of-day, Miles & More already gives absolute UTC
    // timestamps, so there's no ambiguous day boundary to correct). Drop
    // the exact times rather than importing a negative-duration flight.
    if (departure && arrival && arrival < departure) {
      console.warn(
        `Miles & More import: arrival before departure for ${segment.AirlineDesignatorCode}${segment.FlightNumber} on ${segment.DepartureDate}, dropping exact times`,
      );
      departure = null;
      arrival = null;
    }

    const flightIndex = flights.length;

    if (!from) {
      unknownAirports[segment.OriginAirportCode] ??= [];
      unknownAirports[segment.OriginAirportCode]!.push(flightIndex);
    }
    if (!to) {
      unknownAirports[segment.DestinationAirportCode] ??= [];
      unknownAirports[segment.DestinationAirportCode]!.push(flightIndex);
    }
    if (!airline) {
      unknownAirlines[segment.AirlineDesignatorCode] ??= [];
      unknownAirlines[segment.AirlineDesignatorCode]!.push(flightIndex);
    }
    if (!aircraft && aircraftKey) {
      unknownAircraft[aircraftKey] ??= [];
      unknownAircraft[aircraftKey]!.push(flightIndex);
    }

    flights.push({
      date: segment.DepartureDate,
      from: from || null,
      to: to || null,
      departure: departure ? departure.toISOString() : null,
      arrival: arrival ? arrival.toISOString() : null,
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
      duration: segment.TimeOnPlane ?? null,
      note: buildNote(segment),
      aircraft,
      aircraftReg: null,
      airline: airline || null,
      flightNumber:
        `${segment.AirlineDesignatorCode}${segment.FlightNumber}`.substring(
          0,
          10,
        ),
      passengers: [
        {
          userId,
          seat: null,
          seatNumber: null,
          seatClass: mapCompartmentClass(segment.CompartmentClass),
          guestName: null,
          flightReason: null,
        },
      ],
    });
  }

  return {
    flights,
    unknowns: {
      airports: unknownAirports,
      airlines: unknownAirlines,
      aircraft: unknownAircraft,
    },
    exportedUsers: [],
    skippedRows,
  };
};
