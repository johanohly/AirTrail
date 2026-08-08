import { describe, expect, it } from 'vitest';

import {
  buildFlightListYears,
  sortByDepartureDesc,
} from './flight-list-groups';

import type { Airport, Flight } from '$lib/db/types';
import { prepareFlightData } from '$lib/utils';

const airport = (id: number, tz: string): Airport =>
  ({ id, tz, lon: 0, lat: 0 }) as Airport;

const LHR = airport(1, 'Europe/London');
const DXB = airport(2, 'Asia/Dubai');
const SYD = airport(3, 'Australia/Sydney');

type FlightInput = {
  id: number;
  from: Airport;
  to: Airport;
  date: string;
  departure: string;
  arrival: string;
};

const flight = ({ id, from, to, date, departure, arrival }: FlightInput) =>
  ({
    id,
    from,
    to,
    date,
    datePrecision: 'day',
    departure,
    arrival,
    duration: null,
    departureScheduled: null,
    arrivalScheduled: null,
    takeoffScheduled: null,
    takeoffActual: null,
    landingScheduled: null,
    landingActual: null,
  }) as Flight;

/** Flights are handed to the list newest first. */
const build = (flights: Flight[], now: string) =>
  buildFlightListYears(prepareFlightData(flights), new Date(now));

const groupedIds = (years: ReturnType<typeof build>) =>
  years.flatMap((year) =>
    year.groups.map((group) => group.flights.map((f) => f.id)),
  );

// LHR -> DXB -> SYD, connecting in Dubai after a 3h stop.
const dubaiConnection = [
  flight({
    id: 2,
    from: DXB,
    to: SYD,
    date: '2024-03-02',
    departure: '2024-03-02T05:00:00.000Z',
    arrival: '2024-03-02T18:00:00.000Z',
  }),
  flight({
    id: 1,
    from: LHR,
    to: DXB,
    date: '2024-03-01',
    departure: '2024-03-01T20:00:00.000Z',
    arrival: '2024-03-02T02:00:00.000Z',
  }),
];

describe('sortByDepartureDesc', () => {
  const order = (flights: Flight[]) =>
    sortByDepartureDesc(prepareFlightData(flights)).map((f) => f.id);

  it('orders same-day flights on their scheduled time when none has flown', () => {
    // Upcoming flights only carry scheduled times, so ordering them on the
    // start of their day leaves same-day departures tied.
    const [onward, inbound] = dubaiConnection.map(
      (f) =>
        ({
          ...f,
          departure: null,
          arrival: null,
          departureScheduled: f.departure,
          arrivalScheduled: f.arrival,
          date: '2024-03-02',
        }) as Flight,
    );

    expect(order([inbound!, onward!])).toEqual([2, 1]);
    expect(order([onward!, inbound!])).toEqual([2, 1]);
  });

  it('orders flown flights on their recorded time', () => {
    const [onward, inbound] = dubaiConnection;

    expect(order([inbound!, onward!])).toEqual([2, 1]);
  });

  it('puts flights without a usable date last', () => {
    const undated = {
      ...dubaiConnection[0]!,
      id: 4,
      date: '',
      departure: null,
      arrival: null,
    } as Flight;

    expect(order([undated, ...dubaiConnection])).toEqual([2, 1, 4]);
  });
});

describe('buildFlightListYears', () => {
  it('groups legs connected by a layover', () => {
    expect(groupedIds(build(dubaiConnection, '2024-06-01T00:00:00Z'))).toEqual([
      [2, 1],
    ]);
  });

  it('keeps legs apart when the stop is longer than 12 hours', () => {
    const [onward, inbound] = dubaiConnection;
    const later = {
      ...onward!,
      departure: '2024-03-02T15:00:00.000Z',
      arrival: '2024-03-03T04:00:00.000Z',
    } as Flight;

    expect(
      groupedIds(build([later, inbound!], '2024-06-01T00:00:00Z')),
    ).toEqual([[2], [1]]);
  });

  it('keeps legs apart when the second one starts somewhere else', () => {
    const [onward, inbound] = dubaiConnection;
    const elsewhere = { ...onward!, from: SYD, to: DXB } as Flight;

    expect(
      groupedIds(build([elsewhere, inbound!], '2024-06-01T00:00:00Z')),
    ).toEqual([[2], [1]]);
  });

  it('does not group flights that have no times to compare', () => {
    const untimed = dubaiConnection.map(
      (f) => ({ ...f, departure: null, arrival: null }) as Flight,
    );

    expect(groupedIds(build(untimed, '2024-06-01T00:00:00Z'))).toEqual([
      [2],
      [1],
    ]);
  });

  it('marks the first flown flight below the upcoming ones', () => {
    const years = build(dubaiConnection, '2024-03-02T10:00:00Z');

    // The Dubai stop is over, so the onward leg is still upcoming while the
    // inbound one has landed: the run is cut at the boundary.
    expect(groupedIds(years)).toEqual([[2], [1]]);
    expect(years[0]!.groups.map((group) => group.startsPastSection)).toEqual([
      false,
      true,
    ]);
  });

  it('marks the boundary on the first group of an older year', () => {
    const [onward] = dubaiConnection;
    const upcoming = {
      ...onward!,
      id: 3,
      date: '2025-01-10',
      departure: '2025-01-10T05:00:00.000Z',
      arrival: '2025-01-10T18:00:00.000Z',
    } as Flight;

    const years = build([upcoming, ...dubaiConnection], '2024-06-01T00:00:00Z');

    expect(years.map((year) => year.year)).toEqual([2025, 2024]);
    expect(years[0]!.groups[0]!.startsPastSection).toBe(false);
    expect(years[1]!.groups[0]!.startsPastSection).toBe(true);
  });

  it('leaves the boundary unmarked when every flight has been flown', () => {
    const years = build(dubaiConnection, '2024-06-01T00:00:00Z');

    expect(
      years.flatMap((year) =>
        year.groups.map((group) => group.startsPastSection),
      ),
    ).toEqual([false]);
  });

  it('sorts undated flights into their own trailing year', () => {
    const undated = {
      ...dubaiConnection[0]!,
      id: 4,
      date: '',
      departure: null,
      arrival: null,
    } as Flight;

    const years = build([...dubaiConnection, undated], '2024-06-01T00:00:00Z');

    expect(years.map((year) => year.year)).toEqual([2024, 0]);
    expect(groupedIds(years)).toEqual([[2, 1], [4]]);
  });
});
