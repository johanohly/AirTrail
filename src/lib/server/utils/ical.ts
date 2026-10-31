import { createHash } from 'node:crypto';

import { TZDate } from '@date-fns/tz';

import type { Flight } from '$lib/db/types';

/**
 * Options controlling the generated feed.
 *
 * `now` is injectable so DTSTAMP stays deterministic in tests.
 */
export type CalendarFeedOptions = {
  /** Feed owner id; hashed into every event UID. */
  userId: string;
  /** Owner display name, used for `X-WR-CALNAME`. */
  displayName: string;
  /** Prefix flight titles with the airplane emoji. */
  showEmoji: boolean;
  /** Minutes before departure for a reminder alarm, or null for none. */
  reminderOffsetMinutes: number | null;
  /** Generation time, defaults to the current time. */
  now?: Date;
};

export type CalendarFlight = Flight;

const LINE_LIMIT = 75;
const UID_DOMAIN = '@airtrail';

const pad2 = (value: number) => value.toString().padStart(2, '0');

/**
 * Escape a value for use in an ICS text property: backslash and newlines
 * only. RFC 5545 also demands escaping `:`/`,`/`;`, but several widely used
 * calendar clients (notably Proton Calendar) render those escapes literally,
 * while every parser splits values on the first colon only — so leaving them
 * unescaped displays correctly everywhere.
 */
export const escapeText = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n');

/**
 * Fold a content line to at most 75 octets, continuing each following chunk
 * with a single space. Splits never cut through a UTF-8 multibyte character.
 */
export const foldLine = (line: string): string => {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= LINE_LIMIT) return line;

  const chunks: string[] = [];
  let start = 0;
  while (start < bytes.length) {
    const limit = LINE_LIMIT - (start === 0 ? 0 : 1);
    let end = Math.min(start + limit, bytes.length);
    if (end < bytes.length) {
      // Step back over UTF-8 continuation bytes to the start of a character.
      while (end > start && (bytes[end]! & 0xc0) === 0x80) end -= 1;
      // Prefer breaking just after a space so words stay whole in the raw
      // file; unfolding restores the original either way.
      const space = bytes.lastIndexOf(0x20, end - 1);
      if (space > start) end = space + 1;
    }
    chunks.push(bytes.subarray(start, end).toString('utf8'));
    start = end;
  }

  return chunks.join('\r\n ');
};

/**
 * Parse a stored timestamp as UTC. Values without an explicit offset are
 * treated as UTC because every AirTrail timestamp is stored that way.
 */
const parseUtcIso = (iso: string): Date | null => {
  const normalized = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** `YYYYMMDDTHHMMSSZ` */
const utcStamp = (date: Date): string =>
  `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(
    date.getUTCDate(),
  )}T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(
    date.getUTCSeconds(),
  )}Z`;

/** `YYYYMMDD` */
const dateStamp = (date: string): string => date.replaceAll('-', '');

/** The day after a `YYYY-MM-DD` date, still in `YYYY-MM-DD` form. */
const nextDay = (date: string): string => {
  const [year, month, day] = date.split('-').map(Number);
  const shifted = new Date(
    Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + 1),
  );
  return shifted.toISOString().slice(0, 10);
};

/** `HH:mm` wall time of an instant inside `tzId`. */
const localTime = (iso: string, tzId: string | null): string | null => {
  const date = parseUtcIso(iso);
  if (!date) return null;
  const local = new TZDate(date, tzId ?? 'UTC');
  return `${pad2(local.getHours())}:${pad2(local.getMinutes())}`;
};

/*
 * Airport-local event times. Events carry a `TZID` parameter plus a generated
 * `VTIMEZONE` whose observances have explicit onsets derived by probing the
 * IANA database through `Intl`, so calendars render the wall time of the
 * departure/arrival airports regardless of the viewer's own timezone.
 */
const partsFormatters = new Map<string, Intl.DateTimeFormat>();
const abbrevFormatters = new Map<string, Intl.DateTimeFormat>();

const partsFormatter = (tzId: string): Intl.DateTimeFormat => {
  let formatter = partsFormatters.get(tzId);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tzId,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    partsFormatters.set(tzId, formatter);
  }
  return formatter;
};

const abbrevFormatter = (tzId: string): Intl.DateTimeFormat => {
  let formatter = abbrevFormatters.get(tzId);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tzId,
      timeZoneName: 'short',
    });
    abbrevFormatters.set(tzId, formatter);
  }
  return formatter;
};

/** Wall-clock parts of an instant inside `tzId`. */
const wallParts = (tzId: string, epochMs: number) => {
  const parts = partsFormatter(tzId).formatToParts(new Date(epochMs));
  const get = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
};

/** `YYYYMMDDTHHMMSS` wall time inside `tzId`, without a UTC designator. */
const wallStamp = (tzId: string, epochMs: number): string => {
  const parts = wallParts(tzId, epochMs);
  return `${parts.year}${pad2(parts.month)}${pad2(parts.day)}T${pad2(
    parts.hour,
  )}${pad2(parts.minute)}${pad2(parts.second)}`;
};

/**
 * Offset of `tzId` east of UTC in minutes at the given instant, derived from
 * the difference between wall time and UTC so it works without relying on
 * `timeZoneName` offset formats.
 */
const offsetMinutes = (tzId: string, epochMs: number): number => {
  const parts = wallParts(tzId, epochMs);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return Math.round((asUtc - epochMs) / 60000);
};

/** `+HHMM` / `-HHMM` for an offset given in minutes. */
const formatOffset = (minutes: number): string =>
  `${minutes < 0 ? '-' : '+'}${pad2(Math.floor(Math.abs(minutes) / 60))}${pad2(
    Math.abs(minutes) % 60,
  )}`;

/** Short zone abbreviation such as `CEST`, falling back to the offset. */
const zoneAbbrev = (tzId: string, epochMs: number): string => {
  const part = abbrevFormatter(tzId)
    .formatToParts(new Date(epochMs))
    .find((candidate) => candidate.type === 'timeZoneName');
  return part?.value ?? formatOffset(offsetMinutes(tzId, epochMs));
};

interface ZoneTransition {
  at: number;
  before: number;
  after: number;
}

/**
 * UTC-offset transitions of `tzId` inside `[startMs, endMs]`, found by
 * sampling every five days and binary-searching each change to the minute.
 */
const findZoneTransitions = (
  tzId: string,
  startMs: number,
  endMs: number,
): ZoneTransition[] => {
  const transitions: ZoneTransition[] = [];
  const stepMs = 5 * 86400_000;
  let previousAt = startMs;
  let previousOffset = offsetMinutes(tzId, startMs);

  for (let at = startMs + stepMs; at < endMs + stepMs; at += stepMs) {
    const sample = Math.min(at, endMs);
    const offset = offsetMinutes(tzId, sample);
    if (offset !== previousOffset) {
      let low = previousAt;
      let high = sample;
      while (high - low > 60_000) {
        const mid = low + Math.floor((high - low) / 2);
        if (offsetMinutes(tzId, mid) === previousOffset) low = mid;
        else high = mid;
      }
      // Transitions fall on whole minutes; snap the bisected instant so the
      // emitted onset matches the tz database value exactly.
      transitions.push({
        at: Math.floor(high / 60_000) * 60_000,
        before: previousOffset,
        after: offset,
      });
      previousOffset = offset;
    }
    previousAt = sample;
  }

  return transitions;
};

const vTimezoneCache = new Map<string, string[]>();

/**
 * `VTIMEZONE` lines covering exactly the span of instants used. Observances
 * carry explicit onsets (no `RRULE`), which RFC 5545 permits and which lets
 * strict clients resolve offsets without their own tz database.
 */
const vTimezoneLines = (
  tzId: string,
  startMs: number,
  endMs: number,
): string[] => {
  const cacheKey = `${tzId}:${startMs}:${endMs}`;
  const cached = vTimezoneCache.get(cacheKey);
  if (cached) return cached;

  const transitions = findZoneTransitions(tzId, startMs, endMs);
  const offsets = [
    offsetMinutes(tzId, startMs),
    ...transitions.map((transition) => transition.after),
  ];
  // The larger offset in a changing zone is the daylight one.
  const isDaylight = (offset: number) =>
    transitions.length > 0 && offset === Math.max(...offsets);

  const observance = (
    kind: 'STANDARD' | 'DAYLIGHT',
    atMs: number,
    from: number,
    to: number,
  ): string[] => [
    `BEGIN:${kind}`,
    `DTSTART:${wallStamp(tzId, atMs)}`,
    `TZOFFSETFROM:${formatOffset(from)}`,
    `TZOFFSETTO:${formatOffset(to)}`,
    `TZNAME:${zoneAbbrev(tzId, atMs)}`,
    `END:${kind}`,
  ];

  const baseOffset = offsetMinutes(tzId, startMs);
  const lines = [
    'BEGIN:VTIMEZONE',
    `TZID:${tzId}`,
    ...observance(
      isDaylight(baseOffset) ? 'DAYLIGHT' : 'STANDARD',
      startMs,
      baseOffset,
      baseOffset,
    ),
    ...transitions.flatMap((transition) =>
      observance(
        isDaylight(transition.after) ? 'DAYLIGHT' : 'STANDARD',
        transition.at,
        transition.before,
        transition.after,
      ),
    ),
    'END:VTIMEZONE',
  ];

  vTimezoneCache.set(cacheKey, lines);
  return lines;
};

/** The code shown for an airport: IATA when present, otherwise ICAO. */
const airportCode = (airport: { iata: string | null; icao: string }) =>
  airport.iata ?? airport.icao;

/** `Name (CODE), Municipality, Country`, omitting missing parts. */
export const airportLabel = (airport: {
  name: string;
  iata: string | null;
  icao: string;
  municipality: string | null;
  country: string;
}): string => {
  const code = airportCode(airport);
  const head = airport.name
    ? code
      ? `${airport.name} (${code})`
      : airport.name
    : code;
  return [head, airport.municipality, airport.country]
    .filter((part) => Boolean(part))
    .join(', ');
};

/** Latitude/longitude with 3-5 decimal places. */
export const formatGeo = (value: number): string => {
  const trimmed = value.toFixed(5).replace(/0+$/, '').replace(/\.$/, '');
  const [whole, decimals = ''] = trimmed.split('.');
  return decimals.length >= 3 ? trimmed : `${whole}.${decimals.padEnd(3, '0')}`;
};

/** `1h 50m` */
export const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (rest > 0 || hours === 0) parts.push(`${rest}m`);
  return parts.join(' ');
};

const firstPresent = <T>(
  ...values: readonly (T | null | undefined)[]
): T | null => values.find((value) => value != null && value !== '') ?? null;

/** `-PT30M`, `-PT1H`, `-P1D` */
export const formatTrigger = (minutes: number): string => {
  if (minutes % 1440 === 0) return `-P${minutes / 1440}D`;
  if (minutes % 60 === 0) return `-PT${minutes / 60}H`;
  return `-PT${minutes}M`;
};

const flightUid = (flightId: number, userId: string): string =>
  createHash('sha256')
    .update(`${flightId}:${userId}`)
    .digest('hex')
    .slice(0, 24) + UID_DOMAIN;

const summary = (
  flight: CalendarFlight,
  options: CalendarFeedOptions,
): string => {
  const from = flight.from ? airportCode(flight.from) : null;
  const to = flight.to ? airportCode(flight.to) : null;
  const route = from && to ? `${from} → ${to}` : '';
  const title = firstPresent(flight.flightNumber, flight.airline?.name ?? null);
  const parts = [title, route].filter((part): part is string => Boolean(part));
  const prefix = options.showEmoji ? '✈ ' : '';
  return `${prefix}${parts.join(' · ')}`;
};

const segmentLine = (
  kind: 'Departs' | 'Arrives',
  airport: CalendarFlight['from'],
  shownIso: string | null,
  terminal: string | null,
  gate: string | null,
): string => {
  const time = shownIso && airport ? localTime(shownIso, airport.tz) : null;
  const timePart = time ? ` ${time} local` : '';
  const label = airport ? airportLabel(airport) : null;
  const labelPart = label ? ` — ${label}` : '';
  const extrasPart = segmentExtras(terminal, gate)
    .map((value) => ` · ${value}`)
    .join('');
  return `${kind}:${timePart}${labelPart}${extrasPart}`;
};

const segmentExtras = (
  terminal: string | null,
  gate: string | null,
): string[] => {
  const parts: string[] = [];
  if (terminal) parts.push(`Terminal ${terminal}`);
  if (gate) parts.push(`Gate ${gate}`);
  return parts;
};

/**
 * The `Actual 14:20 · Takeoff 14:32` line, two-space indented, or null when
 * there is nothing extra to say.
 */
const extraTimesLine = (
  actualIso: string | null,
  scheduledShownIso: string | null,
  plannedIso: string | null,
  plannedLabel: 'Takeoff' | 'Landing',
  airport: CalendarFlight['from'],
): string | null => {
  if (!airport) return null;

  const parts: string[] = [];
  const actual = actualIso ? localTime(actualIso, airport.tz) : null;
  const shown = scheduledShownIso
    ? localTime(scheduledShownIso, airport.tz)
    : null;
  if (actual && actual !== shown) parts.push(`Actual ${actual}`);

  const planned = plannedIso ? localTime(plannedIso, airport.tz) : null;
  if (planned) parts.push(`${plannedLabel} ${planned}`);

  return parts.length > 0 ? `  ${parts.join(' · ')}` : null;
};

/** `Airline · Aircraft (reg)`, or null when neither is known. */
const headerLine = (flight: CalendarFlight): string | null => {
  const parts: string[] = [];
  if (flight.airline?.name) parts.push(flight.airline.name);
  if (flight.aircraft?.name) {
    parts.push(
      flight.aircraftReg
        ? `${flight.aircraft.name} (${flight.aircraftReg})`
        : flight.aircraft.name,
    );
  }
  return parts.length > 0 ? parts.join(' · ') : null;
};

/**
 * The `Departs:`/`Arrives:` block — the scheduled (or actual) main line plus
 * the indented extra-times line beneath it.
 */
const scheduleBlock = (
  kind: 'Departs' | 'Arrives',
  airport: CalendarFlight['from'],
  shownIso: string | null,
  extras: string | null,
  terminal: string | null,
  gate: string | null,
  allDay: boolean,
): string =>
  [
    segmentLine(kind, airport, allDay ? null : shownIso, terminal, gate),
    allDay ? null : extras,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');

/** `Duration: 1h 40m`, from the stored seconds or the event times. */
const durationLine = (
  flight: CalendarFlight,
  startIso: string | null,
  endIso: string | null,
  allDay: boolean,
): string | null => {
  if (allDay) return null;
  // flight.duration is stored in seconds; the computed fallback is minutes.
  const minutes =
    flight.duration != null
      ? Math.round(flight.duration / 60)
      : startIso && endIso
        ? Math.round(
            (parseUtcIso(endIso)!.getTime() -
              parseUtcIso(startIso)!.getTime()) /
              60000,
          )
        : null;
  return minutes !== null ? `Duration: ${formatDuration(minutes)}` : null;
};

/** `Seat: 12A · window · economy` from the owner's own passenger entry. */
const seatLine = (flight: CalendarFlight, userId: string): string | null => {
  const passenger = flight.passengers.find(
    (candidate) => candidate.userId === userId,
  );
  const parts = [
    passenger?.seatNumber,
    passenger?.seat,
    passenger?.seatClass,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? `Seat: ${parts.join(' · ')}` : null;
};

const pushDefined = (
  blocks: string[],
  line: string | null | undefined,
): void => {
  if (line) blocks.push(line);
};

const description = (
  flight: CalendarFlight,
  options: CalendarFeedOptions,
  allDay: boolean,
  startIso: string | null,
  endIso: string | null,
): string | null => {
  const blocks: string[] = [];
  const departureShown = firstPresent(
    flight.departureScheduled,
    flight.departure,
  );
  const arrivalShown = firstPresent(flight.arrivalScheduled, flight.arrival);

  pushDefined(blocks, headerLine(flight));
  pushDefined(
    blocks,
    scheduleBlock(
      'Departs',
      flight.from,
      departureShown,
      extraTimesLine(
        flight.departure,
        departureShown,
        firstPresent(flight.takeoffActual, flight.takeoffScheduled),
        'Takeoff',
        flight.from,
      ),
      flight.departureTerminal,
      flight.departureGate,
      allDay,
    ),
  );
  pushDefined(
    blocks,
    scheduleBlock(
      'Arrives',
      flight.to,
      arrivalShown,
      extraTimesLine(
        flight.arrival,
        arrivalShown,
        firstPresent(flight.landingActual, flight.landingScheduled),
        'Landing',
        flight.to,
      ),
      flight.arrivalTerminal,
      flight.arrivalGate,
      allDay,
    ),
  );
  pushDefined(blocks, durationLine(flight, startIso, endIso, allDay));
  pushDefined(blocks, seatLine(flight, options.userId));
  if (flight.note) blocks.push(`Note: ${flight.note}`);

  return blocks.length > 0 ? blocks.join('\n\n') : null;
};

/** Flights without both airports or with a coarse date are not shown. */
export const isFeedEligible = (flight: CalendarFlight): boolean =>
  Boolean(flight.from && flight.to) &&
  flight.datePrecision !== 'month' &&
  flight.datePrecision !== 'year';

/** Scheduled-first event time chains shared by events and zone spans. */
const eventTimes = (flight: CalendarFlight) => ({
  start: firstPresent(
    flight.departureScheduled,
    flight.departure,
    flight.takeoffScheduled,
    flight.takeoffActual,
  ),
  end: firstPresent(
    flight.arrivalScheduled,
    flight.arrival,
    flight.landingScheduled,
    flight.landingActual,
  ),
});

const eventLines = (
  flight: CalendarFlight,
  options: CalendarFeedOptions,
  now: Date,
): string[] => {
  const { start, end } = eventTimes(flight);
  const allDay = !start && !end;

  const lines = [
    'BEGIN:VEVENT',
    `UID:${flightUid(flight.id, options.userId)}`,
    `DTSTAMP:${utcStamp(now)}`,
  ];

  if (allDay) {
    lines.push(`DTSTART;VALUE=DATE:${dateStamp(flight.date)}`);
    lines.push(`DTEND;VALUE=DATE:${dateStamp(nextDay(flight.date))}`);
  } else {
    if (start) {
      const epochMs = parseUtcIso(start)!.getTime();
      const tzId = flight.from?.tz ?? 'UTC';
      lines.push(`DTSTART;TZID=${tzId}:${wallStamp(tzId, epochMs)}`);
    }
    if (end) {
      const epochMs = parseUtcIso(end)!.getTime();
      const tzId = flight.to?.tz ?? 'UTC';
      lines.push(`DTEND;TZID=${tzId}:${wallStamp(tzId, epochMs)}`);
    }
  }

  lines.push(`SUMMARY:${escapeText(summary(flight, options))}`);

  if (flight.from) {
    lines.push(`LOCATION:${escapeText(airportLabel(flight.from))}`);
    lines.push(
      `GEO:${formatGeo(flight.from.lat)};${formatGeo(flight.from.lon)}`,
    );
  }

  const text = description(flight, options, allDay, start, end);
  if (text) lines.push(`DESCRIPTION:${escapeText(text)}`);

  lines.push('TRANSP:OPAQUE', 'CATEGORIES:TRAVEL', 'STATUS:CONFIRMED');

  if (options.reminderOffsetMinutes != null) {
    lines.push(
      'BEGIN:VALARM',
      `TRIGGER:${formatTrigger(options.reminderOffsetMinutes)}`,
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText('Flight departs soon')}`,
      'END:VALARM',
    );
  }

  lines.push('END:VEVENT');
  return lines;
};

/** Build the complete VCALENDAR document for a user's flights. */
export const buildCalendarFeed = (
  flights: CalendarFlight[],
  options: CalendarFeedOptions,
): string => {
  const now = options.now ?? new Date();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AirTrail//Flight Calendar//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeText(`${options.displayName}'s flights`)}`,
    'X-PUBLISHED-TTL:P1D',
  ];

  const eligible = flights.filter(isFeedEligible);

  // One VTIMEZONE per used zone, spanning exactly the events' instants.
  const zoneSpans = new Map<string, { min: number; max: number }>();
  for (const flight of eligible) {
    const { start, end } = eventTimes(flight);
    const stamps: Array<[string | null, string | undefined]> = [
      [start, flight.from?.tz],
      [end, flight.to?.tz],
    ];
    for (const [iso, tzId] of stamps) {
      if (!iso || !tzId) continue;
      const epochMs = parseUtcIso(iso)?.getTime();
      if (epochMs == null || Number.isNaN(epochMs)) continue;
      const span = zoneSpans.get(tzId);
      if (span) {
        span.min = Math.min(span.min, epochMs);
        span.max = Math.max(span.max, epochMs);
      } else {
        zoneSpans.set(tzId, { min: epochMs, max: epochMs });
      }
    }
  }
  for (const tzId of [...zoneSpans.keys()].sort((a, b) => a.localeCompare(b))) {
    const span = zoneSpans.get(tzId)!;
    lines.push(...vTimezoneLines(tzId, span.min, span.max));
  }

  for (const flight of eligible) {
    lines.push(...eventLines(flight, options, now));
  }

  lines.push('END:VCALENDAR');
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
};
