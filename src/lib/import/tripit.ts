import { differenceInSeconds, format } from 'date-fns';

import { page } from '$app/state';
import type { PlatformOptions } from '$lib/components/modals/settings/pages/import-page';
import type { CreateFlight } from '$lib/db/types';
import { api } from '$lib/trpc';
import { airlineFromIATA } from '$lib/utils/data/airlines';
import { parseLocalISO } from '$lib/utils/datetime';

// Basic ICS line unfolding: lines beginning with space/tab are continuations
const unfoldIcs = (input: string): string[] => {
  const rawLines = input.replace(/\r\n/g, '\n').split('\n');
  const lines: string[] = [];
  for (const raw of rawLines) {
    if (!raw) {
      lines.push('');
      continue;
    }
    if ((raw.startsWith(' ') || raw.startsWith('\t')) && lines.length) {
      lines[lines.length - 1] += raw.slice(1);
    } else {
      lines.push(raw);
    }
  }
  return lines;
};

// Parse a single ICS property line into { name, params, value }
const parsePropLine = (
  line: string,
): { name: string; params: Record<string, string>; value: string } | null => {
  const idx = line.indexOf(':');
  if (idx === -1) return null;
  const left = line.slice(0, idx);
  const value = line.slice(idx + 1);
  const parts = left.split(';');
  const name = parts[0];
  const params: Record<string, string> = {};
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    const eq = p.indexOf('=');
    if (eq !== -1) {
      const k = p.slice(0, eq).toUpperCase();
      const v = p.slice(eq + 1);
      params[k] = v;
    }
  }
  return { name: name.toUpperCase(), params, value };
};

const toIsoLocal = (dt: string): string | null => {
  // dt like YYYYMMDD or YYYYMMDDTHHMMSS(Z?)
  if (!dt) return null;
  if (dt.length === 8) {
    // date only
    const y = dt.slice(0, 4);
    const m = dt.slice(4, 6);
    const d = dt.slice(6, 8);
    return `${y}-${m}-${d}`;
  }
  // Strip trailing Z for local format build
  const z = dt.endsWith('Z');
  const base = z ? dt.slice(0, -1) : dt;
  const y = base.slice(0, 4);
  const m = base.slice(4, 6);
  const d = base.slice(6, 8);
  const hh = base.slice(9, 11);
  const mm = base.slice(11, 13);
  const ss = base.slice(13, 15) || '00';
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}${z ? 'Z' : ''}`;
};

const parseIcsDate = (value: string, tzid?: string): Date | null => {
  // If value already ends with Z, Date can parse
  if (value.endsWith('Z')) {
    const iso = toIsoLocal(value);
    return iso ? new Date(iso) : null;
  }
  // Otherwise, produce local ISO and interpret with tz if provided
  const isoLocal = toIsoLocal(value);
  if (!isoLocal) return null;
  if (tzid) {
    try {
      const tzDate = parseLocalISO(isoLocal.replace('Z', ''), tzid);
      // parseLocalISO returns a TZDate; convert to JS Date in UTC by toISOString roundtrip
      return new Date(tzDate.toISOString());
    } catch (_) {
      // Fallback to naive UTC
      return new Date(isoLocal);
    }
  }
  return new Date(isoLocal);
};

const unescapeText = (s: string) =>
  s.replace(/\\n/g, '\n').replace(/\\,/g, ',');

const FLIGHT_SUMMARY_REGEX =
  /^(?<flight>[A-Z]{1,3}\d{1,4})\s+(?<from>[A-Z]{3})\s+to\s+(?<to>[A-Z]{3})/;

export const processTripItFile = async (
  input: string,
  options: PlatformOptions,
) => {
  const userId = page.data.user?.id;
  if (!userId) throw new Error('User not found');

  const lines = unfoldIcs(input);

  type Event = {
    summary?: string;
    dtstart?: { value: string; tzid?: string; isDate?: boolean };
    dtend?: { value: string; tzid?: string; isDate?: boolean };
    location?: string;
  };

  const events: Event[] = [];
  let current: Event | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;
    const prop = parsePropLine(line);
    if (!prop) continue;
    if (prop.name === 'SUMMARY') {
      current.summary = unescapeText(prop.value);
    } else if (prop.name === 'LOCATION') {
      current.location = unescapeText(prop.value);
    } else if (prop.name === 'DTSTART') {
      current.dtstart = {
        value: prop.value,
        tzid: prop.params['TZID'],
        isDate: prop.params['VALUE'] === 'DATE' || /\d{8}$/.test(prop.value),
      };
    } else if (prop.name === 'DTEND') {
      current.dtend = {
        value: prop.value,
        tzid: prop.params['TZID'],
        isDate: prop.params['VALUE'] === 'DATE' || /\d{8}$/.test(prop.value),
      };
    }
  }

  const flights: CreateFlight[] = [];
  const unknownAirports: string[] = [];

  for (const ev of events) {
    // Skip all-day events (trip headers)
    if (ev.dtstart?.isDate || ev.dtend?.isDate) continue;
    if (!ev.summary || !ev.dtstart || !ev.dtend) continue;

    const sm = FLIGHT_SUMMARY_REGEX.exec(ev.summary);
    if (!sm || !sm.groups) continue; // not a flight

    const flightNumber = sm.groups['flight'];
    const fromCode = sm.groups['from'];
    const toCode = sm.groups['to'];

    const departure = parseIcsDate(
      ev.dtstart.value,
      ev.dtstart.tzid ?? undefined,
    );
    const arrival = parseIcsDate(ev.dtend.value, ev.dtend.tzid ?? undefined);
    if (!departure || !arrival) continue;

    const from = await api.airport.getFromIATA.query(fromCode);
    const to = await api.airport.getFromIATA.query(toCode);
    if (!from || !to) {
      if (!from && !unknownAirports.includes(fromCode))
        unknownAirports.push(fromCode);
      if (!to && !unknownAirports.includes(toCode))
        unknownAirports.push(toCode);
      continue;
    }

    let airline: string | null = null;
    if (options.airlineFromFlightNumber) {
      const airlineIata = flightNumber.replace(/\d+.*/, '');
      airline = airlineFromIATA(airlineIata)?.icao ?? null;
    }

    flights.push({
      date: format(departure, 'yyyy-MM-dd'),
      from,
      to,
      departure: departure.toISOString(),
      arrival: arrival.toISOString(),
      duration: differenceInSeconds(arrival, departure),
      flightNumber,
      flightReason: null,
      airline,
      aircraft: null,
      aircraftReg: null,
      note: null,
      seats: [
        {
          userId,
          seat: null,
          seatNumber: null,
          seatClass: null,
          guestName: null,
        },
      ],
    });
  }

  return { flights, unknownAirports };
};
