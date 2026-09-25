import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

import { API_SCOPES } from '$lib/api/v1/scopes';
import { API_V1_ERROR_CODES } from '$lib/server/api/v1/errors';
import {
  flightInputSchema,
  passengerInputSchema,
  shareInputSchema,
  visitedCountryInputSchema,
} from '$lib/api/v1/schemas';
import { flightTrackInputSchema } from '$lib/track/schema';
import {
  dateFormatSchema,
  distanceUnitSchema,
  flightTimeDisplaySchema,
  pressureUnitSchema,
  temperatureUnitSchema,
  timeFormatSchema,
  weekStartsOnSchema,
  windSpeedUnitSchema,
} from '$lib/zod/user';
import {
  FlightDatePrecisions,
  FlightReasons,
  SeatClasses,
  SeatTypes,
  VisitedCountryStatus,
} from '$lib/db/types';
import {
  CUSTOM_FIELD_ENTITY_TYPES,
  CUSTOM_FIELD_TYPES,
} from '$lib/utils/custom-fields';

/*
 * The OpenAPI document is written and reviewed by hand on purpose: generated
 * output loses the prose that makes the contract readable. The cost is that
 * nothing stops it from drifting away from the code, so this test reads the
 * YAML and pins every enum, field list and required list that exists in both
 * places. If the document is edited to be more accurate than the code, the test
 * fails too -- and that is the point: the two must move together.
 *
 * What is intentionally not checked: response field lists (asserting them would
 * force the document to document every field it exposes, which is a different
 * decision) and `$ref` targets, which the OpenAPI renderer reports at build
 * time.
 */

const { parse } = createRequire(import.meta.url)('yaml') as {
  parse: (source: string) => Record<string, any>;
};

const spec = parse(
  readFileSync(join(process.cwd(), 'src/lib/api/v1/openapi.yaml'), 'utf8'),
);

const schema = (name: string): Record<string, any> => {
  const found = spec.components.schemas[name];
  expect(found, `components.schemas.${name} is missing`).toBeDefined();
  return found;
};

/** The `enum` of a property, whether it is `type: x` or `type: [x, 'null']`. */
const propertyEnum = (name: string, field: string): string[] => {
  const property = schema(name).properties[field];
  expect(property, `${name}.${field} is missing`).toBeDefined();
  return property.enum;
};

/** A Zod enum's options, without depending on Zod's internal definition keys. */
const options = (zodEnum: unknown): string[] => [
  ...(zodEnum as { options: readonly string[] }).options,
];

const objectProperties = (zodObject: unknown): string[] =>
  Object.keys((zodObject as { shape: Record<string, unknown> }).shape);

const requiredOf = (name: string): string[] => [
  ...(schema(name).required ?? []),
];

describe('enum vocabularies', () => {
  it.each([
    [
      'Airport.type',
      'Airport',
      'type',
      [
        'small_airport',
        'medium_airport',
        'large_airport',
        'heliport',
        'balloonport',
        'seaplane_base',
        'closed',
      ],
    ],
    [
      'Airport.continent',
      'Airport',
      'continent',
      ['AF', 'AS', 'EU', 'NA', 'OC', 'SA', 'AN'],
    ],
    ['Flight.datePrecision', 'Flight', 'datePrecision', FlightDatePrecisions],
    [
      'FlightInput.datePrecision',
      'FlightInput',
      'datePrecision',
      FlightDatePrecisions,
    ],
    ['Passenger.seat', 'Passenger', 'seat', SeatTypes],
    ['Passenger.seatClass', 'Passenger', 'seatClass', SeatClasses],
    ['Passenger.flightReason', 'Passenger', 'flightReason', FlightReasons],
    ['PassengerInput.seat', 'PassengerInput', 'seat', SeatTypes],
    ['PassengerInput.seatClass', 'PassengerInput', 'seatClass', SeatClasses],
    [
      'PassengerInput.flightReason',
      'PassengerInput',
      'flightReason',
      FlightReasons,
    ],
    ['VisitedCountry.status', 'VisitedCountry', 'status', VisitedCountryStatus],
    [
      'VisitedCountryInput.status',
      'VisitedCountryInput',
      'status',
      VisitedCountryStatus,
    ],
    [
      'TrackInput.sourceFormat',
      'TrackInput',
      'sourceFormat',
      ['gpx', 'kml', 'csv', 'readsb'],
    ],
    ['CustomField.fieldType', 'CustomField', 'fieldType', CUSTOM_FIELD_TYPES],
    [
      'CustomField.entityType',
      'CustomField',
      'entityType',
      CUSTOM_FIELD_ENTITY_TYPES,
    ],
    [
      'Preferences.distanceUnit',
      'Preferences',
      'distanceUnit',
      options(distanceUnitSchema),
    ],
    [
      'Preferences.windSpeedUnit',
      'Preferences',
      'windSpeedUnit',
      options(windSpeedUnitSchema),
    ],
    [
      'Preferences.temperatureUnit',
      'Preferences',
      'temperatureUnit',
      options(temperatureUnitSchema),
    ],
    [
      'Preferences.pressureUnit',
      'Preferences',
      'pressureUnit',
      options(pressureUnitSchema),
    ],
    [
      'Preferences.timeFormat',
      'Preferences',
      'timeFormat',
      options(timeFormatSchema),
    ],
    [
      'Preferences.dateFormat',
      'Preferences',
      'dateFormat',
      options(dateFormatSchema),
    ],
    [
      'Preferences.weekStartsOn',
      'Preferences',
      'weekStartsOn',
      options(weekStartsOnSchema),
    ],
    [
      'Preferences.flightTimeDisplay',
      'Preferences',
      'flightTimeDisplay',
      options(flightTimeDisplaySchema),
    ],
  ])(
    '%s matches its source of truth',
    (_label, schemaName, field, expected) => {
      expect(
        [...propertyEnum(schemaName as string, field as string)].sort(),
      ).toEqual([...(expected as readonly string[])].sort());
    },
  );

  it('spells the error codes the API can actually return', () => {
    const codes = schema('ErrorResponse').properties.error.properties.code.enum;
    expect([...codes].sort()).toEqual([...API_V1_ERROR_CODES].sort());
  });

  it('advertises the discoverable scopes', () => {
    const documented =
      schema('Discovery').properties.scopes.items.properties.name.enum;
    // The discovery document enumerates the catalog, so both must agree.
    expect([...documented].sort()).toEqual([...API_SCOPES].sort());
  });
});

describe('input schemas', () => {
  const inputSchemas: [string, unknown][] = [
    ['FlightInput', flightInputSchema],
    ['PassengerInput', passengerInputSchema],
    ['ShareInput', shareInputSchema],
    ['VisitedCountryInput', visitedCountryInputSchema],
    ['TrackInput', flightTrackInputSchema],
  ];

  it.each(inputSchemas)(
    '%s lists the same fields as its Zod schema',
    (name, zodSchema) => {
      expect(Object.keys(schema(name).properties).sort()).toEqual(
        objectProperties(zodSchema).sort(),
      );
    },
  );

  /** A value Zod accepts for each field some input schema requires. */
  const requiredFieldValues: Record<string, unknown> = {
    date: '2026-01-01',
    fromId: 1,
    toId: 1,
    passengers: [{ userId: 'u1', guestName: null }],
    code: 'DE',
    status: 'visited',
    coordinates: [
      [0, 0],
      [1, 1],
    ],
    sourceFormat: 'gpx',
  };

  it.each([
    [
      'FlightInput',
      flightInputSchema,
      ['date', 'fromId', 'toId', 'passengers'],
    ],
    ['ShareInput', shareInputSchema, []],
    ['VisitedCountryInput', visitedCountryInputSchema, ['code', 'status']],
    ['TrackInput', flightTrackInputSchema, ['coordinates', 'sourceFormat']],
  ] as [string, unknown, string[]][])(
    '%s requires the fields Zod requires',
    (name, zodSchema, alwaysRequired) => {
      expect(requiredOf(name).sort()).toEqual([...alwaysRequired].sort());

      // Fields with a Zod default are not required by the transport.
      const parsed = (
        zodSchema as { safeParse: (input: unknown) => { success: boolean } }
      ).safeParse(
        Object.fromEntries(
          alwaysRequired.map((field) => [field, requiredFieldValues[field]]),
        ),
      );
      expect(parsed.success).toBe(true);
    },
  );
});

describe('response shapes', () => {
  it('marks every always-present field as required on Flight', () => {
    const required = requiredOf('Flight').sort();
    expect(required).toEqual(
      [
        'id',
        'date',
        'datePrecision',
        'from',
        'to',
        'airline',
        'aircraft',
        'passengers',
        'track',
      ].sort(),
    );
    /*
     * `from`/`to` are emitted by the server as aliased coordinates, so they are
     * documented as a separate shape. The alias fields are pinned here so a
     * rename in the DTO cannot silently invalidate the document.
     */
    const flightAirport = schema('FlightAirport').properties;
    expect(Object.keys(flightAirport).sort()).toEqual(
      [
        'id',
        'icao',
        'iata',
        'name',
        'municipality',
        'latitude',
        'longitude',
        'timezone',
        'type',
        'continent',
        'country',
      ].sort(),
    );
  });

  it('marks the collected data and paging envelope as required', () => {
    for (const name of [
      'FlightCollection',
      'AirportCollection',
      'AirlineCollection',
      'AircraftCollection',
    ])
      expect(requiredOf(name).sort()).toEqual(['data', 'page']);
  });
});
