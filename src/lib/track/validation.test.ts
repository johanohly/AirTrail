import { describe, expect, it } from 'vitest';

import type { TrackMetadata } from './metadata';
import { validateTrackMetadata, validateTrackTiming } from './validation';
import type { FlightTrackInput } from './schema';

import type { FlightFormData } from '$lib/zod/flight';

const metadata: TrackMetadata = {
  flightIdentifiers: ['CPA216'],
  originCodes: ['MAN', 'EGCC'],
  destinationCodes: ['HKG', 'VHHH'],
};
const form = {
  flightNumber: 'CX216',
  airline: { iata: 'CX', icao: 'CPA' },
  from: { iata: 'MAN', icao: 'EGCC' },
  to: { iata: 'HKG', icao: 'VHHH' },
} as FlightFormData;

describe('track metadata validation', () => {
  it.each(['CX216', 'CPA216', '216', ' cx 216 '])(
    'accepts equivalent flight identifiers: %s',
    (flightNumber) => {
      expect(
        validateTrackMetadata(metadata, { ...form, flightNumber }),
      ).toEqual([]);
    },
  );

  it('reports both airports when the route is reversed', () => {
    expect(
      validateTrackMetadata(metadata, {
        ...form,
        from: form.to,
        to: form.from,
      }).map((issue) => issue.field),
    ).toEqual(['departure', 'arrival']);
  });

  it('reports a different flight and revalidates after form edits', () => {
    expect(
      validateTrackMetadata(metadata, { ...form, flightNumber: 'CX219' })[0]
        ?.field,
    ).toBe('flightNumber');
    expect(validateTrackMetadata(metadata, form)).toEqual([]);
  });

  it('does not warn for missing source metadata or incomplete form fields', () => {
    expect(validateTrackMetadata(null, form)).toEqual([]);
    expect(
      validateTrackMetadata(
        { flightIdentifiers: [], originCodes: [], destinationCodes: [] },
        form,
      ),
    ).toEqual([]);
    expect(
      validateTrackMetadata(metadata, {
        ...form,
        from: null,
        to: null,
        flightNumber: null,
      }),
    ).toEqual([]);
  });

  it('recognizes explicit IATA and callsign aliases without an airline lookup', () => {
    expect(
      validateTrackMetadata(
        { ...metadata, flightIdentifiers: ['CX216', 'CPA216'] },
        { ...form, airline: null },
      ),
    ).toEqual([]);
  });
});

describe('track timing fallback', () => {
  const track: FlightTrackInput = {
    sourceFormat: 'kml',
    coordinates: [
      [0, 0],
      [1, 1],
    ],
    times: [0, 3600],
  };
  const events = { takeoff: null, landing: null };
  const timingForm = {
    ...form,
    from: { ...form.from, tz: 'UTC' },
    to: { ...form.to, tz: 'Asia/Hong_Kong' },
    departureScheduled: null,
    departureScheduledTime: null,
    arrivalScheduled: null,
    arrivalScheduledTime: null,
    departure: '1970-01-03T00:00:00.000Z',
    departureTime: '00:00',
    arrival: '1970-01-03T00:00:00.000Z',
    arrivalTime: '09:00',
  } as FlightFormData;

  it('checks actual departure and arrival when the schedule is absent', () => {
    const issues = validateTrackTiming(
      track,
      {
        ...timingForm,
        // Matching runway times must not override the actual gate times.
        takeoffScheduled: '1970-01-01T00:00:00.000Z',
        takeoffScheduledTime: '00:00',
        landingScheduled: '1970-01-01T00:00:00.000Z',
        landingScheduledTime: '09:00',
      },
      events,
    );
    expect(issues.map((issue) => issue.field)).toEqual([
      'departure',
      'arrival',
    ]);
    expect(
      issues.every((issue) => issue.message.includes('entered actual time')),
    ).toBe(true);
  });

  it.each([
    {
      departureScheduled: '1970-01-01T00:00:00.000Z',
      departureScheduledTime: null,
    },
    { departureScheduled: null, departureScheduledTime: '00:00' },
  ])(
    'falls back to the complete actual pair for an incomplete schedule',
    (schedule) => {
      expect(
        validateTrackTiming(track, { ...timingForm, ...schedule }, events)[0]
          ?.message,
      ).toContain('entered actual time');
    },
  );

  it('prefers a complete schedule and chooses the fallback independently for arrival', () => {
    expect(
      validateTrackTiming(
        track,
        {
          ...timingForm,
          departureScheduled: '1970-01-01T00:00:00.000Z',
          departureScheduledTime: '00:00',
        },
        events,
      ).map((issue) => issue.field),
    ).toEqual(['arrival']);
    expect(
      validateTrackTiming(
        track,
        {
          ...timingForm,
          departure: null,
          arrival: null,
          takeoffScheduled: '1970-01-03T00:00:00.000Z',
          takeoffScheduledTime: '00:00',
          landingActual: '1970-01-03T00:00:00.000Z',
          landingActualTime: '09:00',
        },
        events,
      ),
    ).toEqual([
      expect.objectContaining({ field: 'departure', comparison: 'scheduled' }),
      expect.objectContaining({ field: 'arrival', comparison: 'actual' }),
    ]);
  });

  it('uses the airport timezone for actual times and retains the 24-hour tolerance', () => {
    expect(
      validateTrackTiming(
        track,
        {
          ...timingForm,
          departure: '1970-01-02T00:00:00.000Z',
          arrival: '1970-01-01T00:00:00.000Z',
        },
        events,
      ),
    ).toEqual([]);
  });

  it('skips incomplete pairs and falls back to scheduled then actual OFF/ON times', () => {
    const incomplete = {
      ...timingForm,
      departureTime: null,
      departureScheduledTime: '12:00',
      arrival: null,
    };
    expect(validateTrackTiming(track, incomplete, events)).toEqual([]);
    const runway = {
      ...incomplete,
      takeoffScheduled: '1970-01-01T00:00:00.000Z',
      takeoffScheduledTime: '00:00',
      landingScheduled: '1970-01-01T00:00:00.000Z',
      landingScheduledTime: '09:00',
      takeoffActual: '1970-01-03T00:00:00.000Z',
      takeoffActualTime: '00:00',
      landingActual: '1970-01-03T00:00:00.000Z',
      landingActualTime: '09:00',
    };
    expect(validateTrackTiming(track, runway, events)).toEqual([]);
    expect(
      validateTrackTiming(
        track,
        {
          ...runway,
          takeoffScheduledTime: null,
          landingScheduled: null,
        },
        events,
      ),
    ).toEqual([
      expect.objectContaining({ field: 'departure', comparison: 'actual' }),
      expect.objectContaining({ field: 'arrival', comparison: 'actual' }),
    ]);
  });
});
