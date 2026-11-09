import { describe, expect, it } from 'vitest';

import { buildFlightMilestones } from './flight-milestones';

import type { Airport, Flight, FlightPassenger } from '$lib/db/types';
import { prepareFlightData, type FlightData } from '$lib/utils';

const airport = (id: number, iata: string) =>
  ({ id, iata, icao: `X${iata}`, tz: 'UTC', lon: 0, lat: 0 }) as Airport;

const CPH = airport(1, 'CPH');
const LHR = airport(2, 'LHR');
const HEL = airport(3, 'HEL');

const ME = 'me';

const passenger = (fields: Partial<FlightPassenger> = {}) =>
  ({ userId: ME, seatClass: null, ...fields }) as FlightPassenger;

let nextId = 1;
const flight = (overrides: Partial<Flight> = {}): FlightData =>
  prepareFlightData([
    {
      id: nextId++,
      from: CPH,
      to: LHR,
      date: '2026-03-12',
      datePrecision: 'day',
      departure: null,
      arrival: null,
      airline: null,
      aircraft: null,
      aircraftReg: null,
      passengers: [passenger()],
      ...overrides,
    } as unknown as Flight,
  ])[0]!;

const textsFor = (flights: FlightData[], target = flights.at(-1)!) =>
  buildFlightMilestones(flights, target, ME).map((m) => m.text);

describe('buildFlightMilestones', () => {
  it('shows only the first flight on the very first flight', () => {
    const first = flight({
      passengers: [passenger({ seatClass: 'business' })],
    });
    expect(textsFor([first])).toEqual(['First flight']);
  });

  it('marks a new destination without repeating the new route', () => {
    expect(textsFor([flight(), flight({ to: HEL })])).toEqual([
      'First time at HEL',
    ]);
  });

  it('marks a new route between airports already visited', () => {
    const flights = [flight(), flight({ from: LHR, to: HEL })];
    flights.push(flight({ from: HEL, to: CPH }));
    expect(textsFor(flights)).toEqual(['First flight between HEL and CPH']);
  });

  it('counts a route in both directions', () => {
    const flights = Array.from({ length: 9 }, (_, i) =>
      flight(i % 2 ? { from: LHR, to: CPH } : {}),
    );
    flights.push(flight({ from: LHR, to: CPH }));
    expect(textsFor(flights)).toEqual([
      '10th flight',
      '10th flight between LHR and CPH',
    ]);
  });

  it('leaves out counts that are not round numbers', () => {
    const flights = Array.from({ length: 12 }, () => flight());
    expect(textsFor(flights)).toEqual([]);
  });

  it('marks the first flight with an airline and on an aircraft', () => {
    const airline = { id: 7, name: 'Finnair' };
    const aircraft = { id: 9, name: 'Airbus A350' };
    const flights = [
      flight(),
      flight({ airline, aircraft } as Partial<Flight>),
    ];
    expect(textsFor(flights)).toEqual([
      'First flight with Finnair',
      'First flight on Airbus A350',
    ]);
  });

  it('marks a repeat registration but not a first one', () => {
    const flights = [flight(), flight({ aircraftReg: 'OH-LWA' })];
    expect(textsFor(flights)).toEqual([]);
    flights.push(flight({ aircraftReg: ' OH-LWA ' }));
    expect(textsFor(flights)).toEqual(['2nd flight on OH-LWA']);
  });

  it("marks the traveller's first time in a cabin", () => {
    const flights = [
      flight(),
      flight({
        passengers: [
          passenger({ userId: 'other', seatClass: 'business' }),
          passenger({ seatClass: 'first' }),
        ],
      }),
    ];
    expect(textsFor(flights)).toEqual(['First time in First class']);
  });

  it('counts by position in the given order', () => {
    const late = flight({ to: HEL });
    const early = flight();
    expect(textsFor([early, late], early)).toEqual(['First flight']);
    expect(textsFor([late, early], early)).toEqual(['First time at LHR']);
  });
});
