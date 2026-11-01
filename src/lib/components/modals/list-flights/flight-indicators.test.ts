import { describe, expect, it } from 'vitest';

import { buildFlightIndicators } from './flight-indicators';

import type {
  Airport,
  Flight,
  FlightCustomFieldValue,
  FlightPassenger,
} from '$lib/db/types';
import { prepareFlightData } from '$lib/utils';
import type { CustomFieldDefinition } from '$lib/utils/custom-fields';

const airport = (id: number): Airport =>
  ({ id, tz: 'UTC', lon: 0, lat: 0 }) as Airport;

const CDG = airport(1);
const JFK = airport(2);

const me = (displayName = 'Me'): FlightPassenger =>
  ({ userId: 'me', user: { id: 'me', displayName } }) as FlightPassenger;

const member = (id: string, displayName: string): FlightPassenger =>
  ({ userId: id, user: { id, displayName } }) as FlightPassenger;

const guest = (guestName: string | null): FlightPassenger =>
  ({ userId: null, guestName, user: null }) as FlightPassenger;

const flight = (overrides: Partial<Flight> = {}) =>
  prepareFlightData([
    {
      id: 1,
      from: CDG,
      to: JFK,
      date: '2026-03-12',
      datePrecision: 'day',
      departure: null,
      arrival: null,
      duration: null,
      departureScheduled: null,
      arrivalScheduled: null,
      takeoffScheduled: null,
      takeoffActual: null,
      landingScheduled: null,
      landingActual: null,
      note: null,
      passengers: [],
      ...overrides,
    } as unknown as Flight,
  ])[0]!;

const keys = (...args: Parameters<typeof buildFlightIndicators>) =>
  buildFlightIndicators(...args).map((indicator) => indicator.key);

const labelFor = (
  key: string,
  ...args: Parameters<typeof buildFlightIndicators>
) => buildFlightIndicators(...args).find((i) => i.key === key)?.label;

const definition = (
  id: number,
  label: string,
  fieldType: CustomFieldDefinition['fieldType'] = 'text',
): CustomFieldDefinition => ({
  id,
  entityType: 'flight',
  key: `field_${id}`,
  label,
  description: null,
  fieldType,
  required: false,
  active: true,
  order: id,
  options: null,
  defaultValue: null,
  validationJson: null,
});

const customEntry = (
  fieldId: number,
  value: unknown,
  valueLabel: string | null = null,
): FlightCustomFieldValue => ({ fieldId, value, valueLabel });

const linesFor = (...args: Parameters<typeof buildFlightIndicators>) =>
  buildFlightIndicators(...args).find((i) => i.key === 'customFields')?.lines;

describe('buildFlightIndicators', () => {
  it('returns nothing for a flight with only a date', () => {
    expect(keys(flight())).toEqual([]);
  });

  it('flags a recorded track only when the flight has one', () => {
    expect(keys(flight(), { hasTrack: true })).toEqual(['track']);
    expect(keys(flight(), { hasTrack: false })).toEqual([]);
  });

  it('ignores scheduled-only times', () => {
    const scheduled = flight({
      departureScheduled: '2026-03-12T10:00:00.000Z',
      arrivalScheduled: '2026-03-12T18:00:00.000Z',
    });
    expect(keys(scheduled)).toEqual([]);
  });

  it('describes which actual times are recorded', () => {
    expect(
      labelFor(
        'actualTimes',
        flight({ departure: '2026-03-12T10:04:00.000Z' }),
      ),
    ).toBe('Actual departure time recorded');
    expect(
      labelFor(
        'actualTimes',
        flight({ landingActual: '2026-03-12T18:12:00.000Z' }),
      ),
    ).toBe('Actual arrival time recorded');
    expect(
      labelFor(
        'actualTimes',
        flight({
          departure: '2026-03-12T10:04:00.000Z',
          arrival: '2026-03-12T18:12:00.000Z',
        }),
      ),
    ).toBe('Actual departure and arrival times recorded');
  });

  it('stays quiet when the viewer is the only passenger', () => {
    expect(keys(flight({ passengers: [me()] }), { viewerId: 'me' })).toEqual(
      [],
    );
    expect(keys(flight({ passengers: [] }), { viewerId: 'me' })).toEqual([]);
  });

  it('names the companions travelling with the viewer', () => {
    const shared = flight({
      passengers: [me(), member('bob', 'Bob'), guest('Charlie')],
    });
    expect(labelFor('passengers', shared, { viewerId: 'me' })).toBe(
      'Also on board: Bob, Charlie',
    );
  });

  it('falls back to a count when companions have no name', () => {
    const shared = flight({ passengers: [me(), guest(null), guest(null)] });
    expect(labelFor('passengers', shared, { viewerId: 'me' })).toBe(
      '2 passengers recorded',
    );
  });

  it('keeps unnamed companions in a mixed passenger label', () => {
    const shared = flight({
      passengers: [me(), member('bob', 'Bob'), guest(null)],
    });
    expect(labelFor('passengers', shared, { viewerId: 'me' })).toBe(
      'Also on board: Bob +1',
    );
  });

  it('needs a real group when there is no viewer to exclude', () => {
    const solo = flight({ passengers: [member('bob', 'Bob')] });
    expect(keys(solo)).toEqual([]);

    const group = flight({
      passengers: [member('bob', 'Bob'), guest('Charlie')],
    });
    expect(labelFor('passengers', group)).toBe('Passengers: Bob, Charlie');
  });

  it('can leave passengers out when they are shown elsewhere', () => {
    const group = flight({
      passengers: [member('bob', 'Bob'), guest('Charlie')],
    });
    expect(keys(group, { includePassengers: false })).toEqual([]);
  });

  it('previews the note and truncates long ones', () => {
    expect(labelFor('note', flight({ note: '  Upgraded to J  ' }))).toBe(
      'Note: Upgraded to J',
    );
    expect(labelFor('note', flight({ note: '   ' }))).toBeUndefined();

    const long = 'a'.repeat(200);
    const label = labelFor('note', flight({ note: long }))!;
    expect(label).toBe(`Note: ${'a'.repeat(160)}…`);
  });

  it('does not split Unicode code points when truncating notes', () => {
    const note = `${'a'.repeat(159)}😀x`;
    expect(labelFor('note', flight({ note }))).toBe(
      `Note: ${'a'.repeat(159)}😀…`,
    );
  });

  it('keeps a stable order across all indicators', () => {
    const full = flight({
      departure: '2026-03-12T10:04:00.000Z',
      passengers: [me(), member('bob', 'Bob')],
      note: 'Window seat',
    });
    expect(keys(full, { hasTrack: true, viewerId: 'me' })).toEqual([
      'track',
      'actualTimes',
      'passengers',
      'note',
    ]);
  });

  it('adds no custom-fields indicator without values or definitions', () => {
    const definitions = [definition(1, 'Reason')];
    expect(
      keys(flight({ note: 'Window seat' }), {
        customFieldDefinitions: definitions,
      }),
    ).toEqual(['note']);
    expect(
      keys(flight({ customFields: [customEntry(1, 'Business')] })),
    ).toEqual([]);
    expect(
      keys(flight({ customFields: [] }), {
        customFieldDefinitions: definitions,
      }),
    ).toEqual([]);
  });

  it('lists custom fields in definition order', () => {
    const withValues = flight({
      customFields: [customEntry(2, 'ABC123'), customEntry(1, 'Business')],
    });
    expect(
      linesFor(withValues, {
        customFieldDefinitions: [
          definition(1, 'Reason'),
          definition(2, 'Booking'),
        ],
      }),
    ).toEqual(['Reason: Business', 'Booking: ABC123']);
    expect(
      labelFor('customFields', withValues, {
        customFieldDefinitions: [
          definition(1, 'Reason'),
          definition(2, 'Booking'),
        ],
      }),
    ).toBe('Custom fields: Reason: Business; Booking: ABC123');
  });

  it('skips unknown fields and empty custom field values', () => {
    const withValues = flight({
      customFields: [
        customEntry(9, 'Orphan'),
        customEntry(1, ''),
        customEntry(2, []),
        customEntry(3, 'Kept'),
      ],
    });
    expect(
      linesFor(withValues, {
        customFieldDefinitions: [
          definition(1, 'Text'),
          definition(2, 'Multi', 'multi-select'),
          definition(3, 'Also text'),
        ],
      }),
    ).toEqual(['Also text: Kept']);
  });

  it('formats every custom field type for the tooltip', () => {
    const withValues = flight({
      customFields: [
        customEntry(1, '  12A '),
        customEntry(2, 31),
        customEntry(3, true),
        customEntry(4, false),
        customEntry(5, '2026-03-12'),
        customEntry(6, 'Veggie'),
        customEntry(7, ['Wifi', 'Meal']),
        customEntry(8, 1421, 'London Heathrow'),
      ],
    });
    expect(
      linesFor(withValues, {
        customFieldDefinitions: [
          definition(1, 'Seat', 'text'),
          definition(2, 'Legroom', 'number'),
          definition(3, 'Window', 'boolean'),
          definition(4, 'Aisle', 'boolean'),
          definition(5, 'Flown on', 'date'),
          definition(6, 'Meal', 'select'),
          definition(7, 'Extras', 'multi-select'),
          definition(8, 'Home base', 'airport'),
        ],
      }),
    ).toEqual([
      'Seat: 12A',
      'Legroom: 31',
      'Window: Yes',
      'Aisle: No',
      'Flown on: 2026-03-12',
      'Meal: Veggie',
      'Extras: Wifi, Meal',
      'Home base: London Heathrow',
    ]);
  });

  it('truncates long custom values without splitting code points', () => {
    const withValues = flight({
      customFields: [
        customEntry(1, 'a'.repeat(120)),
        customEntry(2, `${'a'.repeat(99)}😀x`),
      ],
    });
    expect(
      linesFor(withValues, {
        customFieldDefinitions: [
          definition(1, 'Long', 'textarea'),
          definition(2, 'Emoji', 'text'),
        ],
      }),
    ).toEqual([`Long: ${'a'.repeat(100)}…`, `Emoji: ${'a'.repeat(99)}😀…`]);
  });

  it('hides entity values whose referenced object is gone', () => {
    const withValues = flight({
      customFields: [customEntry(1, 1421, null), customEntry(2, 'ABC123')],
    });
    expect(
      linesFor(withValues, {
        customFieldDefinitions: [
          definition(1, 'Home base', 'airport'),
          definition(2, 'Booking'),
        ],
      }),
    ).toEqual(['Booking: ABC123']);
  });

  it('caps the custom-fields summary label like a note', () => {
    const withValues = flight({
      customFields: [
        customEntry(1, 'a'.repeat(100)),
        customEntry(2, 'b'.repeat(100)),
      ],
    });
    expect(
      labelFor('customFields', withValues, {
        customFieldDefinitions: [definition(1, 'One'), definition(2, 'Two')],
      }),
    ).toBe(`Custom fields: One: ${'a'.repeat(100)}; Two: ${'b'.repeat(33)}…`);
  });

  it('places custom fields after the note', () => {
    const full = flight({
      departure: '2026-03-12T10:04:00.000Z',
      passengers: [me(), member('bob', 'Bob')],
      note: 'Window seat',
      customFields: [customEntry(1, 'Business')],
    });
    expect(
      keys(full, {
        hasTrack: true,
        viewerId: 'me',
        customFieldDefinitions: [definition(1, 'Reason')],
      }),
    ).toEqual(['track', 'actualTimes', 'passengers', 'note', 'customFields']);
  });
});
