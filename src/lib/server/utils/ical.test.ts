import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { Airline, Airport, Aircraft, Flight } from '$lib/db/types';

import {
  airportLabel,
  buildCalendarFeed,
  escapeText,
  foldLine,
  formatDuration,
  formatGeo,
  formatTrigger,
  type CalendarFeedOptions,
} from './ical';

const NOW = new Date('2025-06-01T12:34:56Z');

const copenhagen: Airport = {
  id: 1,
  icao: 'EKCH',
  iata: 'CPH',
  lat: 55.618042,
  lon: 12.656,
  tz: 'Europe/Copenhagen',
  name: 'Copenhagen Airport',
  municipality: 'Copenhagen',
  type: 'large_airport',
  continent: 'EU',
  country: 'DK',
  custom: false,
};

const stansted: Airport = {
  id: 2,
  icao: 'EGSS',
  iata: 'STN',
  lat: 51.885,
  lon: 0.235,
  tz: 'Europe/London',
  name: 'London Stansted Airport',
  municipality: 'London',
  type: 'large_airport',
  continent: 'EU',
  country: 'GB',
  custom: false,
};

const airline: Airline = {
  id: 1,
  name: 'Ryanair',
  icao: 'RYR',
  iata: 'FR',
  iconPath: null,
  sourceId: null,
};

const aircraft: Aircraft = {
  id: 1,
  name: 'B738',
  icao: 'B738',
  sourceId: null,
};

const flight = (overrides: Partial<Flight> = {}): Flight => ({
  id: 42,
  date: '2025-07-01',
  datePrecision: 'day',
  departure: null,
  arrival: null,
  departureScheduled: '2025-07-01T09:30:00.000Z',
  arrivalScheduled: '2025-07-01T11:20:00.000Z',
  takeoffScheduled: null,
  takeoffActual: null,
  landingScheduled: null,
  landingActual: null,
  duration: 6600, // stored in seconds (110 minutes)
  departureTerminal: null,
  departureGate: null,
  arrivalTerminal: null,
  arrivalGate: null,
  flightNumber: 'FR7362',
  aircraftReg: null,
  note: null,
  from: copenhagen,
  to: stansted,
  passengers: [],
  aircraft: null,
  airline: null,
  ...overrides,
});

const options = (
  overrides: Partial<CalendarFeedOptions> = {},
): CalendarFeedOptions => ({
  userId: 'user-1',
  displayName: 'Diego',
  showEmoji: true,
  reminderOffsetMinutes: null,
  now: NOW,
  ...overrides,
});

const physicalLines = (ics: string): string[] =>
  ics.split('\r\n').filter((line) => line.length > 0);

const unfolded = (ics: string): string[] =>
  ics
    .replaceAll('\r\n ', '')
    .split('\r\n')
    .filter((line) => line.length > 0);

const unescape = (value: string): string =>
  value.replace(/\\([,;:\\n])/g, (_match, char) =>
    char === 'n' ? '\n' : char,
  );

/** Raw (still escaped) property value. */
const property = (ics: string, name: string): string | undefined => {
  const line = unfolded(ics).find((candidate) =>
    candidate.startsWith(`${name}:`),
  );
  return line?.slice(name.length + 1);
};

/** Unescaped property value. */
const text = (ics: string, name: string): string =>
  unescape(property(ics, name) ?? '');

const description = (ics: string): string => text(ics, 'DESCRIPTION');

/** The whole feed rendered as one logical (unfolded, unescaped) block list. */
const event = (ics: string): string[] => {
  const lines = unfolded(ics);
  const start = lines.indexOf('BEGIN:VEVENT');
  const end = lines.indexOf('END:VEVENT');
  return lines.slice(start, end + 1);
};

describe('escapeText', () => {
  it('escapes backslash but leaves commas, semicolons and colons alone', () => {
    expect(escapeText('a\\b,c;d:e')).toBe('a\\\\b,c;d:e');
  });

  it('converts newlines to literal \\n and drops carriage returns', () => {
    expect(escapeText('one\ntwo\r\nthree')).toBe('one\\ntwo\\nthree');
  });

  it('treats a bare carriage return as a newline', () => {
    expect(escapeText('one\rtwo\r\n\rthree')).toBe('one\\ntwo\\n\\nthree');
  });

  it('strips control characters but keeps tabs', () => {
    expect(escapeText('a\x00b\x0bc\x1bd\x7fe\tf')).toBe('abcde\tf');
  });

  it('leaves plain text alone', () => {
    expect(escapeText("Diego's flights")).toBe("Diego's flights");
  });
});

describe('foldLine', () => {
  it('leaves short lines untouched', () => {
    expect(foldLine('SHORT:ok')).toBe('SHORT:ok');
  });

  it('folds long ascii lines at 75 octets with a single leading space', () => {
    const line = `NOTE:${'a'.repeat(200)}`;
    const folded = foldLine(line);
    const parts = folded.split('\r\n');

    for (const part of parts) {
      expect(Buffer.byteLength(part, 'utf8')).toBeLessThanOrEqual(75);
    }
    expect(parts[0]).toHaveLength(75);
    for (const part of parts.slice(1)) {
      expect(part.startsWith(' ')).toBe(true);
    }
    expect(folded.replaceAll('\r\n ', '')).toBe(line);
  });

  it('never splits a UTF-8 multibyte character', () => {
    const line = `NOTE:${'日'.repeat(60)}`;
    const parts = foldLine(line).split('\r\n');

    for (const part of parts) {
      expect(Buffer.byteLength(part, 'utf8')).toBeLessThanOrEqual(75);
      expect(part).not.toContain('�');
    }
    expect(foldLine(line).replaceAll('\r\n ', '')).toBe(line);
  });

  it('folds emoji-heavy text without producing invalid sequences', () => {
    const line = `SUMMARY:✈ ${'✈'.repeat(40)} · CPH → STN`;
    const parts = foldLine(line).split('\r\n');

    for (const part of parts) {
      expect(Buffer.byteLength(part, 'utf8')).toBeLessThanOrEqual(75);
      expect(part).not.toContain('�');
    }
  });
});

describe('formatGeo', () => {
  it('keeps 3-5 decimal places', () => {
    expect(formatGeo(55.618042)).toBe('55.61804');
    expect(formatGeo(12.656)).toBe('12.656');
    expect(formatGeo(12)).toBe('12.000');
    expect(formatGeo(-0.5)).toBe('-0.500');
    expect(formatGeo(0.12345678)).toBe('0.12346');
  });
});

describe('formatDuration', () => {
  it('formats minutes as hours and minutes', () => {
    expect(formatDuration(110)).toBe('1h 50m');
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(45)).toBe('45m');
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(1440)).toBe('24h');
  });
});

describe('formatTrigger', () => {
  it('maps reminder offsets to RFC 5545 triggers', () => {
    expect(formatTrigger(30)).toBe('-PT30M');
    expect(formatTrigger(60)).toBe('-PT1H');
    expect(formatTrigger(120)).toBe('-PT2H');
    expect(formatTrigger(180)).toBe('-PT3H');
    expect(formatTrigger(1440)).toBe('-P1D');
    expect(formatTrigger(45)).toBe('-PT45M');
  });
});

describe('airportLabel', () => {
  it('joins the present parts', () => {
    expect(airportLabel(copenhagen)).toBe(
      'Copenhagen Airport (CPH), Copenhagen, DK',
    );
    expect(
      airportLabel({ ...copenhagen, iata: null, municipality: null }),
    ).toBe('Copenhagen Airport (EKCH), DK');
  });
});

describe('buildCalendarFeed', () => {
  it('emits the VCALENDAR header with the display name and CRLF endings', () => {
    const ics = buildCalendarFeed([flight()], options());

    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(unfolded(ics).slice(0, 6)).toEqual([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//AirTrail//Flight Calendar//EN',
      'CALSCALE:GREGORIAN',
      "X-WR-CALNAME:Diego's flights",
      'X-PUBLISHED-TTL:P1D',
    ]);
    expect(unfolded(ics).at(-1)).toBe('END:VCALENDAR');
    expect(ics).toMatch(/\r\n$/);
  });

  it('uses UTC timestamps for DTSTAMP and event times', () => {
    const ics = buildCalendarFeed(
      [
        flight({
          takeoffScheduled: '2025-07-01T09:42:00.000Z',
          takeoffActual: '2025-07-01T09:47:00.000Z',
        }),
      ],
      options(),
    );

    expect(property(ics, 'DTSTAMP')).toBe('20250601T123456Z');
    expect(property(ics, 'DTSTART')).toBe('20250701T093000Z');
    expect(property(ics, 'DTEND')).toBe('20250701T112000Z');
  });

  it('falls back through the departure chain', () => {
    const ics = buildCalendarFeed(
      [
        flight({
          departureScheduled: null,
          departure: '2025-07-01T09:35:00.000Z',
          arrivalScheduled: null,
          arrival: '2025-07-01T11:25:00.000Z',
          duration: null,
        }),
      ],
      options(),
    );

    expect(property(ics, 'DTSTART')).toBe('20250701T093500Z');
    expect(property(ics, 'DTEND')).toBe('20250701T112500Z');
    expect(description(ics)).toContain('Duration: 1h 50m');
  });

  it('treats the stored duration as seconds', () => {
    const ics = buildCalendarFeed(
      [flight({ duration: 6000 })], // 6000s = 1h 40m, not 100h
      options(),
    );

    expect(description(ics)).toContain('Duration: 1h 40m');
  });

  it('falls back to takeoff/landing times when departure/arrival are gone', () => {
    const ics = buildCalendarFeed(
      [
        flight({
          departureScheduled: null,
          departure: null,
          takeoffScheduled: '2025-07-01T09:40:00.000Z',
          takeoffActual: '2025-07-01T09:45:00.000Z',
          arrivalScheduled: null,
          arrival: null,
          landingScheduled: '2025-07-01T11:15:00.000Z',
          landingActual: '2025-07-01T11:18:00.000Z',
          duration: null,
        }),
      ],
      options(),
    );

    expect(property(ics, 'DTSTART')).toBe('20250701T094000Z');
    expect(property(ics, 'DTEND')).toBe('20250701T111500Z');
  });

  it('emits an all-day event when no times exist', () => {
    const ics = buildCalendarFeed(
      [
        flight({
          departureScheduled: null,
          arrivalScheduled: null,
          duration: null,
          date: '2025-12-31',
        }),
      ],
      options(),
    );

    expect(property(ics, 'DTSTART;VALUE=DATE')).toBe('20251231');
    expect(property(ics, 'DTEND;VALUE=DATE')).toBe('20260101');
    expect(property(ics, 'DTSTART')).toBeUndefined();
  });

  it('crosses month and year boundaries for all-day end dates', () => {
    const ics = buildCalendarFeed(
      [
        flight({
          departureScheduled: null,
          arrivalScheduled: null,
          duration: null,
          date: '2025-01-31',
        }),
      ],
      options(),
    );

    expect(property(ics, 'DTEND;VALUE=DATE')).toBe('20250201');
  });

  it('builds the summary cascade with the emoji prefix', () => {
    const withNumber = buildCalendarFeed(
      [flight({ airline })],
      options({ showEmoji: true }),
    );
    expect(property(withNumber, 'SUMMARY')).toBe('✈ FR7362 · CPH → STN');

    const airlineOnly = buildCalendarFeed(
      [flight({ airline, flightNumber: null })],
      options({ showEmoji: true }),
    );
    expect(property(airlineOnly, 'SUMMARY')).toBe('✈ Ryanair · CPH → STN');

    const bare = buildCalendarFeed(
      [flight({ flightNumber: null })],
      options({ showEmoji: true }),
    );
    expect(property(bare, 'SUMMARY')).toBe('✈ CPH → STN');
  });

  it('drops the emoji prefix when showEmoji is off', () => {
    const ics = buildCalendarFeed(
      [flight({ airline })],
      options({ showEmoji: false }),
    );
    expect(text(ics, 'SUMMARY')).toBe('FR7362 · CPH → STN');
  });

  it('uses IATA when present and ICAO otherwise', () => {
    const ics = buildCalendarFeed(
      [flight({ from: { ...copenhagen, iata: null } })],
      options({ showEmoji: false }),
    );
    expect(text(ics, 'SUMMARY')).toBe('FR7362 · EKCH → STN');
  });

  it('renders LOCATION and GEO from the departure airport', () => {
    const ics = buildCalendarFeed([flight()], options());

    expect(text(ics, 'LOCATION')).toBe(
      'Copenhagen Airport (CPH), Copenhagen, DK',
    );
    expect(property(ics, 'GEO')).toBe('55.61804;12.656');
  });

  it('hashes the UID from flight and user ids', () => {
    const ics = buildCalendarFeed([flight({ id: 42 })], options());

    const expected =
      createHash('sha256').update('42:user-1').digest('hex').slice(0, 24) +
      '@airtrail';
    expect(property(ics, 'UID')).toBe(expected);
    expect(property(ics, 'UID')).toMatch(/^[0-9a-f]{24}@airtrail$/);
  });

  it('keeps UIDs stable across feed options and does not leak the raw id', () => {
    const first = buildCalendarFeed(
      [flight({ id: 7 })],
      options({ showEmoji: false, reminderOffsetMinutes: 30 }),
    );
    const second = buildCalendarFeed(
      [flight({ id: 7 })],
      options({ displayName: 'Someone Else', reminderOffsetMinutes: null }),
    );
    expect(property(first, 'UID')).toBe(property(second, 'UID'));
    expect(property(first, 'UID')).not.toContain('7@');
  });

  it('renders local wall times in the airport timezone', () => {
    const ics = buildCalendarFeed(
      [flight({ from: { ...copenhagen, tz: 'Asia/Tokyo' } })],
      options(),
    );

    // 09:30Z is 18:30 in Tokyo in July.
    expect(description(ics)).toContain(
      'Departs: 18:30 local — Copenhagen Airport (CPH), Copenhagen, DK',
    );
    expect(description(ics)).toContain(
      'Arrives: 12:20 local — London Stansted Airport (STN), London, GB',
    );
  });

  it('includes terminal and gate when present', () => {
    const ics = buildCalendarFeed(
      [
        flight({
          departureTerminal: '2',
          departureGate: 'A12',
          arrivalTerminal: 'S',
          arrivalGate: 'B3',
        }),
      ],
      options(),
    );

    expect(description(ics)).toContain(
      'Departs: 11:30 local — Copenhagen Airport (CPH), Copenhagen, DK · Terminal 2 · Gate A12',
    );
    expect(description(ics)).toContain(
      'Arrives: 12:20 local — London Stansted Airport (STN), London, GB · Terminal S · Gate B3',
    );
  });

  it('adds the extra-times sub-line with differing actual and takeoff times', () => {
    const ics = buildCalendarFeed(
      [
        flight({
          departure: '2025-07-01T09:35:00.000Z',
          takeoffActual: '2025-07-01T09:47:00.000Z',
          arrival: '2025-07-01T11:15:00.000Z',
          landingActual: '2025-07-01T11:12:00.000Z',
        }),
      ],
      options(),
    );

    const text = description(ics);
    expect(text).toContain('  Actual 11:35 · Takeoff 11:47');
    expect(text).toContain('  Actual 12:15 · Landing 12:12');
    // Blocks are separated by a blank line.
    expect(text).toContain('  Actual 11:35 · Takeoff 11:47\n\nArrives:');
  });

  it('omits the actual sub-line when the actual time matches the shown time', () => {
    const ics = buildCalendarFeed(
      [
        flight({
          departureScheduled: null,
          departure: '2025-07-01T09:35:00.000Z',
          arrivalScheduled: null,
          arrival: '2025-07-01T11:15:00.000Z',
        }),
      ],
      options(),
    );

    expect(description(ics)).not.toContain('Actual');
    expect(description(ics)).toContain('Departs: 11:35 local');
  });

  it('prefers takeoff scheduled when no actual takeoff exists', () => {
    const ics = buildCalendarFeed(
      [
        flight({
          takeoffScheduled: '2025-07-01T09:40:00.000Z',
          landingScheduled: '2025-07-01T11:15:00.000Z',
        }),
      ],
      options(),
    );

    expect(description(ics)).toContain('Takeoff 11:40');
    expect(description(ics)).toContain('Landing 12:15');
  });

  it('formats the description header from airline and aircraft', () => {
    const full = buildCalendarFeed(
      [flight({ airline, aircraft, aircraftReg: 'EI-DCL' })],
      options(),
    );
    expect(description(full).split('\n')[0]).toBe('Ryanair · B738 (EI-DCL)');

    const noReg = buildCalendarFeed(
      [flight({ airline, aircraft, aircraftReg: null })],
      options(),
    );
    expect(description(noReg).split('\n')[0]).toBe('Ryanair · B738');

    const airlineOnly = buildCalendarFeed([flight({ airline })], options());
    expect(description(airlineOnly).split('\n')[0]).toBe('Ryanair');

    const none = buildCalendarFeed([flight()], options());
    expect(description(none).split('\n')[0]).toContain('Departs:');
  });

  it('shows the seat of the feed owner only', () => {
    const own = buildCalendarFeed(
      [
        flight({
          passengers: [
            {
              id: 1,
              flightId: 42,
              userId: 'user-1',
              guestName: null,
              seat: 'window',
              seatNumber: '12A',
              seatClass: 'economy',
              flightReason: null,
              user: null,
            },
            {
              id: 2,
              flightId: 42,
              userId: 'user-2',
              guestName: null,
              seat: 'aisle',
              seatNumber: '1C',
              seatClass: 'business',
              flightReason: null,
              user: null,
            },
          ],
        }),
      ],
      options(),
    );
    expect(description(own)).toContain('Seat: 12A · window · economy');

    const partial = buildCalendarFeed(
      [
        flight({
          passengers: [
            {
              id: 1,
              flightId: 42,
              userId: 'user-1',
              guestName: null,
              seat: 'middle',
              seatNumber: null,
              seatClass: null,
              flightReason: null,
              user: null,
            },
          ],
        }),
      ],
      options(),
    );
    expect(description(partial)).toContain('Seat: middle');

    const other = buildCalendarFeed(
      [
        flight({
          passengers: [
            {
              id: 1,
              flightId: 42,
              userId: 'user-2',
              guestName: null,
              seat: 'aisle',
              seatNumber: '1C',
              seatClass: 'business',
              flightReason: null,
              user: null,
            },
          ],
        }),
      ],
      options(),
    );
    expect(description(other)).not.toContain('Seat:');
  });

  it('escapes commas, semicolons and newlines in the note', () => {
    const ics = buildCalendarFeed(
      [flight({ note: 'Window, exit row; quiet\nflight' })],
      options(),
    );

    expect(property(ics, 'DESCRIPTION')).toContain(
      'Note: Window, exit row; quiet\\nflight',
    );
  });

  it('never lets a control character in a note break the content line', () => {
    const ics = buildCalendarFeed(
      [flight({ note: 'first\rBEGIN:VEVENT\x07' })],
      options(),
    );

    expect(
      unfolded(ics).filter((line) => line === 'BEGIN:VEVENT'),
    ).toHaveLength(1);
    expect(property(ics, 'DESCRIPTION')).toContain(
      'Note: first\\nBEGIN:VEVENT',
    );
    expect(ics).not.toContain('\x07');
  });

  it('escapes special characters in airport names', () => {
    const ics = buildCalendarFeed(
      [flight({ from: { ...copenhagen, name: 'Kastrup, Reg: København' } })],
      options(),
    );

    expect(property(ics, 'LOCATION')).toBe(
      'Kastrup, Reg: København (CPH), Copenhagen, DK',
    );
  });

  it('adds a VALARM when a reminder offset is set', () => {
    const ics = buildCalendarFeed(
      [flight()],
      options({ reminderOffsetMinutes: 30 }),
    );
    const lines = event(ics);

    expect(lines).toContain('BEGIN:VALARM');
    expect(lines).toContain('TRIGGER:-PT30M');
    expect(lines).toContain('ACTION:DISPLAY');
    expect(lines).toContain('DESCRIPTION:Flight departs soon');
    expect(lines).toContain('END:VALARM');

    const day = buildCalendarFeed(
      [flight()],
      options({ reminderOffsetMinutes: 1440 }),
    );
    expect(event(day)).toContain('TRIGGER:-P1D');
  });

  it('omits the VALARM without a reminder offset', () => {
    const ics = buildCalendarFeed([flight()], options());
    expect(event(ics)).not.toContain('BEGIN:VALARM');
  });

  it('emits opaque, travel-categorised, confirmed events', () => {
    const lines = event(buildCalendarFeed([flight()], options()));

    expect(lines).toContain('TRANSP:OPAQUE');
    expect(lines).toContain('CATEGORIES:TRAVEL');
    expect(lines).toContain('STATUS:CONFIRMED');
  });

  it('excludes flights without both airports', () => {
    const ics = buildCalendarFeed(
      [flight({ from: null }), flight({ to: null }), flight({ id: 99 })],
      options({ showEmoji: false }),
    );

    expect(
      unfolded(ics).filter((line) => line === 'BEGIN:VEVENT'),
    ).toHaveLength(1);
    expect(property(ics, 'UID')).toMatch(/^[0-9a-f]{24}@airtrail$/);
  });

  it('excludes month and year precision flights', () => {
    const ics = buildCalendarFeed(
      [
        flight({ id: 1, datePrecision: 'month', date: '2025-07' }),
        flight({ id: 2, datePrecision: 'year', date: '2025' }),
      ],
      options(),
    );

    expect(unfolded(ics)).not.toContain('BEGIN:VEVENT');
    expect(unfolded(ics)).toContain('END:VCALENDAR');
  });

  it('renders every physical line within the 75 octet limit', () => {
    const ics = buildCalendarFeed(
      [
        flight({
          airline,
          aircraft,
          aircraftReg: 'EI-DCL',
          note: 'A very long note with plenty of detail '.repeat(4),
          departureGate: 'A12',
        }),
      ],
      options({ reminderOffsetMinutes: 60 }),
    );

    for (const line of physicalLines(ics)) {
      expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75);
    }

    // Unfolding must restore the original logical lines.
    expect(unfolded(ics)).toContain('BEGIN:VEVENT');
    expect(description(ics)).toContain(
      'Note: A very long note with plenty of detail',
    );
  });

  it('keeps DTSTART/DTEND lines unfolded so parsers see them whole', () => {
    const ics = buildCalendarFeed([flight()], options());
    expect(physicalLines(ics)).toContain('DTSTART:20250701T093000Z');
  });
});

describe('event times', () => {
  it('emits UTC instants in winter and summer without any timezone data', () => {
    const ics = buildCalendarFeed(
      [
        flight({
          date: '2025-01-15',
          departureScheduled: '2025-01-15T09:30:00.000Z',
          arrivalScheduled: '2025-01-15T11:20:00.000Z',
        }),
        flight(),
      ],
      options(),
    );
    const lines = unfolded(ics);

    expect(lines).toContain('DTSTART:20250115T093000Z');
    expect(lines).toContain('DTEND:20250115T112000Z');
    expect(lines).toContain('DTSTART:20250701T093000Z');
    expect(lines).toContain('DTEND:20250701T112000Z');
    expect(ics).not.toContain('TZID');
    expect(ics).not.toContain('VTIMEZONE');
  });

  it('starts an arrival-only flight at its arrival, without a DTEND', () => {
    const ics = buildCalendarFeed(
      [flight({ departureScheduled: null, duration: null })],
      options(),
    );

    expect(property(ics, 'DTSTART')).toBe('20250701T112000Z');
    expect(property(ics, 'DTEND')).toBeUndefined();
    expect(description(ics)).toContain('Arrives: 12:20 local');
  });

  it('leaves DTEND out of a departure-only flight', () => {
    const ics = buildCalendarFeed(
      [flight({ arrivalScheduled: null, duration: null })],
      options(),
    );

    expect(property(ics, 'DTSTART')).toBe('20250701T093000Z');
    expect(property(ics, 'DTEND')).toBeUndefined();
  });

  it('keeps airport-local times in the description across DST', () => {
    const winter = buildCalendarFeed(
      [
        flight({
          date: '2025-01-15',
          departureScheduled: '2025-01-15T09:30:00.000Z',
          arrivalScheduled: '2025-01-15T11:20:00.000Z',
        }),
      ],
      options(),
    );

    // CET is UTC+1 in January, CEST UTC+2 in July.
    expect(description(winter)).toContain('Departs: 10:30 local');
    expect(description(winter)).toContain('Arrives: 11:20 local');
    expect(description(buildCalendarFeed([flight()], options()))).toContain(
      'Departs: 11:30 local',
    );
  });
});

describe('invalid airport timezones', () => {
  it('shows that airport in UTC and keeps the rest of the flight local', () => {
    const ics = buildCalendarFeed(
      [
        flight({
          from: { ...copenhagen, tz: 'Not/AZone' },
          departure: '2025-07-01T09:35:00.000Z',
        }),
      ],
      options(),
    );

    expect(property(ics, 'DTSTART')).toBe('20250701T093000Z');
    expect(description(ics)).toContain('Departs: 09:30 UTC');
    expect(description(ics)).toContain('  Actual 09:35');
    expect(description(ics)).toContain('Arrives: 12:20 local');
    expect(ics).not.toContain('NaN');
  });
});

describe('client compatibility', () => {
  it('never escapes colons or commas, which Proton Calendar renders literally', () => {
    const ics = buildCalendarFeed([flight({ note: 'a,b;c:d' })], options());

    expect(ics).not.toContain('\\:');
    expect(ics).not.toContain('\\,');
    expect(ics).not.toContain('\\;');
    // Newlines still need escaping.
    expect(ics).toContain('\\n');
  });

  it('folds at word boundaries when spaces are available', () => {
    const line = `DESCRIPTION:${'departure lounge '.repeat(12)}`;
    const folded = foldLine(line);
    const parts = folded.split('\r\n');

    for (const part of parts) {
      expect(Buffer.byteLength(part, 'utf8')).toBeLessThanOrEqual(75);
    }
    // Every continuation starts with the fold space followed by a word
    // character, never in the middle of a word.
    for (const part of parts.slice(1)) {
      expect(/^ \w/.test(part)).toBe(true);
    }
    expect(folded.replaceAll('\r\n ', '')).toBe(line);
  });
});
