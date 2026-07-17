import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import { describe, expect, it } from 'vitest';

import {
  buildMergeFieldStates,
  getFetchedSources,
  isConflict,
  type FormatTime,
  type LookupResultLike,
  type MergeFieldKey,
  type MergeFieldState,
} from './merge-fields';
import type { FlightFormData } from '$lib/zod/flight';

const airport = (id: number, icao: string, iata: string) =>
  ({ id, icao, iata, name: `${icao} Airport` }) as FlightFormData['from'];

const airline = (id: number, name: string) =>
  ({ id, name, icao: null, iata: null }) as FlightFormData['airline'];

const aircraft = (id: number, name: string) =>
  ({ id, name, icao: null }) as FlightFormData['aircraft'];

const baseForm = (overrides: Partial<FlightFormData> = {}): FlightFormData =>
  ({
    from: null,
    to: null,
    airline: null,
    aircraft: null,
    aircraftReg: null,
    departure: null,
    departureTime: null,
    arrival: null,
    arrivalTime: null,
    departureScheduled: null,
    departureScheduledTime: null,
    arrivalScheduled: null,
    arrivalScheduledTime: null,
    departureTerminal: null,
    departureGate: null,
    arrivalTerminal: null,
    arrivalGate: null,
    ...overrides,
  }) as FlightFormData;

const baseResult = (
  overrides: Partial<LookupResultLike> = {},
): LookupResultLike => ({
  from: airport(2, 'EGLL', 'LHR'),
  to: airport(3, 'KJFK', 'JFK'),
  airline: null,
  aircraftReg: null,
  departure: null,
  arrival: null,
  departureScheduled: null,
  arrivalScheduled: null,
  departureTerminal: null,
  departureGate: null,
  arrivalTerminal: null,
  arrivalGate: null,
  ...overrides,
});

const formatTime: FormatTime = (date) => format(date, 'HH:mm');

const build = (current: FlightFormData, result: LookupResultLike) =>
  buildMergeFieldStates({
    current,
    result,
    aircraft: null,
    sources: getFetchedSources(result, false),
    formatTime,
  });

const byKey = (states: MergeFieldState[], key: MergeFieldKey) => {
  const state = states.find((s) => s.key === key);
  if (!state) throw new Error(`missing field ${key}`);
  return state;
};

describe('buildMergeFieldStates', () => {
  it('marks a differing both-present field as a conflict', () => {
    const states = build(
      baseForm({ from: airport(1, 'EHAM', 'AMS') }),
      baseResult({ from: airport(2, 'EGLL', 'LHR') }),
    );

    const from = byKey(states, 'from');
    expect(from.currentPresent).toBe(true);
    expect(from.fetchedPresent).toBe(true);
    expect(from.equal).toBe(false);
    expect(isConflict(from)).toBe(true);
    expect(from.currentDisplay).toBe('AMS');
    expect(from.fetchedDisplay).toBe('LHR');
  });

  it('does not flag identical overlapping values as conflicts', () => {
    const same = airport(2, 'EGLL', 'LHR');
    const states = build(baseForm({ from: same }), baseResult({ from: same }));

    const from = byKey(states, 'from');
    expect(from.equal).toBe(true);
    expect(isConflict(from)).toBe(false);
    // Still available to apply (harmless — same value).
    expect(from.fetchedPresent).toBe(true);
  });

  it('never treats an empty fetched value as a conflict or applies it', () => {
    const states = build(
      baseForm({ departureGate: 'A12' }),
      baseResult({ departureGate: null }),
    );

    const gate = byKey(states, 'departureGate');
    expect(gate.currentPresent).toBe(true);
    expect(gate.fetchedPresent).toBe(false);
    expect(isConflict(gate)).toBe(false);
  });

  it('applies fetched-only fields without a conflict', () => {
    const states = build(
      baseForm(), // no current departure airport
      baseResult({ from: airport(2, 'EGLL', 'LHR') }),
    );

    const from = byKey(states, 'from');
    expect(from.currentPresent).toBe(false);
    expect(from.fetchedPresent).toBe(true);
    expect(isConflict(from)).toBe(false);
  });

  it('compares datetimes by their date and time parts', () => {
    const dep = new TZDate('2026-01-01T14:30:00Z', 'UTC');
    const arr = new TZDate('2026-01-01T18:00:00Z', 'UTC');

    const current = baseForm({
      departure: '2026-01-01T00:00:00.000Z',
      departureTime: '14:30',
      arrival: '2026-01-01T00:00:00.000Z',
      arrivalTime: '17:00', // differs from fetched 18:00
    });
    const result = baseResult({ departure: dep, arrival: arr });

    const states = buildMergeFieldStates({
      current,
      result,
      aircraft: null,
      sources: getFetchedSources(result, false),
      formatTime,
    });

    expect(isConflict(byKey(states, 'departure'))).toBe(false); // 14:30 == 14:30
    expect(isConflict(byKey(states, 'arrival'))).toBe(true); // 17:00 != 18:00
  });

  it('compares airline and aircraft by id and name', () => {
    const states = build(
      baseForm({
        airline: airline(1, 'KLM'),
        aircraft: aircraft(1, 'Boeing 737'),
      }),
      baseResult({ airline: airline(2, 'British Airways') }),
    );

    expect(isConflict(byKey(states, 'airline'))).toBe(true);
    // Aircraft only present on the current side -> not a conflict.
    expect(byKey(states, 'aircraft').fetchedPresent).toBe(false);
  });
});

describe('getFetchedSources', () => {
  const dep = new TZDate('2026-01-01T14:30:00Z', 'UTC');
  const arr = new TZDate('2026-01-01T18:00:00Z', 'UTC');

  it('provides actual times only for non-future flights with both endpoints', () => {
    const sources = getFetchedSources(
      baseResult({ departure: dep, arrival: arr }),
      false,
    );
    expect(sources.departure).toBe(dep);
    expect(sources.arrival).toBe(arr);
  });

  it('drops actual times for future flights and falls back to scheduled', () => {
    const sources = getFetchedSources(
      baseResult({ departure: dep, arrival: arr }),
      true,
    );
    expect(sources.departure).toBeNull();
    expect(sources.arrival).toBeNull();
    expect(sources.departureScheduled).toBe(dep);
    expect(sources.arrivalScheduled).toBe(arr);
  });

  it('omits actual times when only one endpoint is present', () => {
    const sources = getFetchedSources(baseResult({ departure: dep }), false);
    expect(sources.departure).toBeNull();
    expect(sources.arrival).toBeNull();
  });
});
