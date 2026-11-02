import { describe, expect, it } from 'vitest';

import {
  buildFlightMilestones,
  formatOrdinal,
  type FlightMilestone,
} from './flight-milestones';

import type {
  Aircraft,
  Airline,
  Airport,
  Flight,
  FlightPassenger,
} from '$lib/db/types';
import { prepareFlightData } from '$lib/utils';

const airport = (
  id: number,
  iata?: string | null,
  icao?: string | null,
): Airport =>
  ({
    id,
    iata: iata ?? null,
    icao: icao ?? null,
    tz: 'UTC',
    lon: 0,
    lat: 0,
  }) as Airport;

const DXB = airport(1, 'DXB');
const DUB = airport(2, 'DUB');
const LHR = airport(3, 'LHR');
const JFK = airport(4, 'JFK');

const airline = (id: number, name: string): Airline =>
  ({ id, name }) as Airline;
const aircraft = (id: number, name: string): Aircraft =>
  ({ id, name }) as Aircraft;

const passenger = (
  userId: string | null,
  fields: Partial<FlightPassenger> = {},
): FlightPassenger =>
  ({
    userId,
    guestName: null,
    seat: null,
    seatNumber: null,
    seatClass: null,
    flightReason: null,
    user: null,
    ...fields,
  }) as FlightPassenger;

const flight = (overrides: Partial<Flight> = {}) =>
  prepareFlightData([
    {
      id: 1,
      from: DXB,
      to: DUB,
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

const keysOf = (milestones: FlightMilestone[]) =>
  milestones.map((milestone) => milestone.key);

const find = (
  milestones: FlightMilestone[],
  key: FlightMilestone['key'],
): FlightMilestone | undefined =>
  milestones.find((milestone) => milestone.key === key);

describe('formatOrdinal', () => {
  it.each([
    [1, '1st'],
    [2, '2nd'],
    [3, '3rd'],
    [4, '4th'],
    [11, '11th'],
    [12, '12th'],
    [13, '13th'],
    [21, '21st'],
    [101, '101st'],
    [111, '111th'],
    [112, '112th'],
    [113, '113th'],
  ])('formats %i as %s', (n, expected) => {
    expect(formatOrdinal(n)).toBe(expected);
  });
});

describe('buildFlightMilestones', () => {
  it('counts every earlier flight, labelling the milestone plainly', () => {
    const first = flight({ id: 1, date: '2026-01-05' });
    const second = flight({ id: 2, date: '2026-02-05' });
    const third = flight({ id: 3, date: '2026-03-05' });
    const scope = [first, second, third];

    const overall = find(buildFlightMilestones(scope, third), 'overall')!;
    expect(overall.ordinal).toBe(3);
    expect(overall.label).toBe('flight');

    expect(find(buildFlightMilestones(scope, first), 'overall')!.ordinal).toBe(
      1,
    );
  });

  it('counts a route in both directions as the same milestone', () => {
    const outbound = flight({ id: 1, date: '2026-01-05' });
    const inbound = flight({
      id: 2,
      date: '2026-02-05',
      from: DUB,
      to: DXB,
    });
    const again = flight({ id: 3, date: '2026-03-05' });
    const scope = [outbound, inbound, again];

    const milestone = find(buildFlightMilestones(scope, again), 'route')!;
    expect(milestone.ordinal).toBe(3);
    expect(milestone.label).toBe('flight DUB – DXB');

    const inboundMilestone = find(
      buildFlightMilestones(scope, inbound),
      'route',
    )!;
    expect(inboundMilestone.label).toBe(milestone.label);
    expect(inboundMilestone.ordinal).toBe(2);
  });

  it('falls back to ICAO codes for the route label', () => {
    const icaoFlight = flight({
      id: 1,
      from: airport(10, null, 'OMDB'),
      to: airport(11, null, 'EIDW'),
    });
    expect(
      find(buildFlightMilestones([icaoFlight], icaoFlight), 'route')!.label,
    ).toBe('flight EIDW – OMDB');
  });

  it('skips the route milestone when an endpoint has no code', () => {
    const codeless = flight({ id: 1, to: airport(12) });
    expect(
      find(buildFlightMilestones([codeless], codeless), 'route'),
    ).toBeUndefined();
  });

  it('groups airlines by id, not by name', () => {
    const renamed = flight({
      id: 1,
      date: '2026-01-05',
      airline: airline(1, 'Emirates'),
    });
    const namesake = flight({
      id: 2,
      date: '2026-02-05',
      airline: airline(2, 'Emirates'),
    });
    const scope = [renamed, namesake];

    expect(
      find(buildFlightMilestones(scope, namesake), 'airline')!.ordinal,
    ).toBe(1);
    expect(find(buildFlightMilestones(scope, renamed), 'airline')!.label).toBe(
      'flight by Emirates',
    );
  });

  it('skips the airline milestone when no airline is set', () => {
    const lone = flight({ id: 1, airline: null });
    expect(
      find(buildFlightMilestones([lone], lone), 'airline'),
    ).toBeUndefined();
  });

  it('groups aircraft by id and names the model plainly', () => {
    const jet = aircraft(1, 'Boeing 777-300ER');
    const scope = [
      flight({ id: 1, date: '2026-01-05', aircraft: jet }),
      flight({
        id: 2,
        date: '2026-02-05',
        aircraft: aircraft(2, 'Boeing 777-300ER'),
      }),
      flight({ id: 3, date: '2026-03-05', aircraft: jet }),
    ];

    const milestone = find(
      buildFlightMilestones(scope, scope[2]!),
      'aircraft',
    )!;
    expect(milestone.ordinal).toBe(2);
    expect(milestone.label).toBe('flight on Boeing 777-300ER');
  });

  it('skips the aircraft milestone when no aircraft is set', () => {
    const lone = flight({ id: 1, aircraft: null });
    expect(
      find(buildFlightMilestones([lone], lone), 'aircraft'),
    ).toBeUndefined();
  });

  it('counts tails by registration', () => {
    const scope = [
      flight({ id: 1, date: '2026-01-05', aircraftReg: 'A6-EQO' }),
      flight({ id: 2, date: '2026-02-05', aircraftReg: 'G-XLEA' }),
      flight({ id: 3, date: '2026-03-05', aircraftReg: 'A6-EQO' }),
    ];

    const milestone = find(buildFlightMilestones(scope, scope[2]!), 'tail')!;
    expect(milestone.ordinal).toBe(2);
    expect(milestone.label).toBe('flight on A6-EQO');
    expect(find(buildFlightMilestones(scope, scope[1]!), 'tail')!.ordinal).toBe(
      1,
    );
  });

  it('skips tails without a usable registration', () => {
    const blank = flight({ id: 1, aircraftReg: '   ' });
    expect(find(buildFlightMilestones([blank], blank), 'tail')).toBeUndefined();

    const padded = flight({ id: 1, aircraftReg: '  A6-EQO  ' });
    expect(find(buildFlightMilestones([padded], padded), 'tail')!.label).toBe(
      'flight on A6-EQO',
    );
  });

  it('scopes seat milestones to the requested passenger', () => {
    const scope = [
      flight({
        id: 1,
        date: '2026-01-05',
        passengers: [passenger('me', { seatNumber: '12A' })],
      }),
      flight({
        id: 2,
        date: '2026-02-05',
        passengers: [passenger('partner', { seatNumber: '12B' })],
      }),
      flight({
        id: 3,
        date: '2026-03-05',
        passengers: [passenger('me', { seatNumber: '12A' })],
      }),
    ];

    const milestone = find(
      buildFlightMilestones(scope, scope[2]!, { seatUserId: 'me' }),
      'seat',
    )!;
    expect(milestone.ordinal).toBe(2);
    expect(milestone.label).toBe('flight on seat 12A');
  });

  it('resolves a lone passenger without a seat scope', () => {
    const scope = [
      flight({
        id: 1,
        date: '2026-01-05',
        passengers: [passenger('me', { seatNumber: '20C' })],
      }),
      flight({
        id: 2,
        date: '2026-02-05',
        passengers: [passenger('me', { seatNumber: '20C' })],
      }),
    ];

    const milestone = find(buildFlightMilestones(scope, scope[1]!), 'seat')!;
    expect(milestone.ordinal).toBe(2);
    expect(milestone.label).toBe('flight on seat 20C');
  });

  it('ignores seats on flights with several passengers', () => {
    const shared = flight({
      id: 1,
      passengers: [
        passenger('me', { seatNumber: '12A' }),
        passenger('partner', { seatNumber: '12B' }),
      ],
    });
    expect(
      find(buildFlightMilestones([shared], shared), 'seat'),
    ).toBeUndefined();
  });

  it('skips seats without a seat number', () => {
    const windowSeat = flight({
      id: 1,
      passengers: [passenger('me', { seat: 'window' })],
    });
    expect(
      find(buildFlightMilestones([windowSeat], windowSeat), 'seat'),
    ).toBeUndefined();
  });

  it('skips seats when the scoped passenger is not on the flight', () => {
    const someoneElse = flight({
      id: 1,
      passengers: [passenger('partner', { seatNumber: '2A' })],
    });
    expect(
      find(
        buildFlightMilestones([someoneElse], someoneElse, {
          seatUserId: 'me',
        }),
        'seat',
      ),
    ).toBeUndefined();
  });

  it('marks the first flight in a cabin class, and only that one', () => {
    const economy = (id: number, date: string) =>
      flight({
        id,
        date,
        passengers: [passenger('me', { seatClass: 'economy' })],
      });
    const business = (id: number, date: string) =>
      flight({
        id,
        date,
        passengers: [passenger('me', { seatClass: 'business' })],
      });

    const scope = [
      economy(1, '2026-01-05'),
      economy(2, '2026-02-05'),
      business(3, '2026-03-05'),
      business(4, '2026-04-05'),
    ];

    const first = find(buildFlightMilestones(scope, scope[2]!), 'cabin-first')!;
    expect(first.firstOnly).toBe(true);
    expect(first.ordinal).toBe(1);
    expect(first.label).toBe('First in Business');

    expect(
      find(buildFlightMilestones(scope, scope[3]!), 'cabin-first'),
    ).toBeUndefined();
  });

  it('never counts other passengers when looking for cabin firsts', () => {
    const theirs = flight({
      id: 1,
      date: '2026-01-05',
      passengers: [passenger('partner', { seatClass: 'business' })],
    });
    const mine = flight({
      id: 2,
      date: '2026-02-05',
      passengers: [passenger('me', { seatClass: 'business' })],
    });

    // The partner flew business first, but that must not consume "mine".
    const milestone = find(
      buildFlightMilestones([theirs, mine], mine, { seatUserId: 'me' }),
      'cabin-first',
    )!;
    expect(milestone.label).toBe('First in Business');
  });

  it('ignores shared flights when attributing cabin firsts', () => {
    const shared = flight({
      id: 1,
      passengers: [
        passenger('me', { seatClass: 'business' }),
        passenger('partner', { seatClass: 'business' }),
      ],
    });
    expect(
      find(buildFlightMilestones([shared], shared), 'cabin-first'),
    ).toBeUndefined();
  });

  it('counts every visit to an airport regardless of direction', () => {
    const scope = [
      flight({ id: 1, date: '2026-01-05', from: DXB, to: LHR }),
      flight({ id: 2, date: '2026-02-05', from: JFK, to: LHR }),
      flight({ id: 3, date: '2026-03-05', from: LHR, to: JFK }),
    ];

    const milestones = buildFlightMilestones(scope, scope[2]!);
    const fromLhr = find(milestones, 'airport-from')!;
    expect(fromLhr.ordinal).toBe(3);
    // The pane prefixes the ordinal, so this chip reads "3rd time at LHR".
    expect(fromLhr.label).toBe('time at LHR');

    const toJfk = find(milestones, 'airport-to')!;
    expect(toJfk.ordinal).toBe(2);
    expect(toJfk.label).toBe('time at JFK');
  });

  it('counts a same-airport flight once, in both directions', () => {
    const dxbLhr = flight({
      id: 1,
      date: '2026-01-05',
      from: DXB,
      to: LHR,
    });
    const lhrLhr = flight({
      id: 2,
      date: '2026-02-05',
      from: LHR,
      to: LHR,
    });

    const milestones = buildFlightMilestones([dxbLhr, lhrLhr], lhrLhr);
    expect(find(milestones, 'airport-from')!.ordinal).toBe(2);
    expect(find(milestones, 'airport-to')!.ordinal).toBe(2);

    // The flight itself is a single visit, not one per endpoint.
    const lone = buildFlightMilestones([lhrLhr], lhrLhr);
    expect(find(lone, 'airport-from')!.ordinal).toBe(1);
    expect(find(lone, 'airport-to')!.ordinal).toBe(1);
  });

  it('breaks same-moment ties by flight id', () => {
    const make = (id: number) =>
      flight({
        id,
        date: '2026-03-12',
        departure: '2026-03-12T10:00:00.000Z',
      });
    const first = make(1);
    const second = make(2);

    expect(
      find(buildFlightMilestones([first, second], first), 'overall')!.ordinal,
    ).toBe(1);
    expect(
      find(buildFlightMilestones([first, second], second), 'overall')!.ordinal,
    ).toBe(2);
  });

  it('ignores later flights but counts earlier ones, future or not', () => {
    const past = flight({ id: 1, date: '2026-01-05' });
    const target = flight({ id: 2, date: '2026-06-05' });
    const laterFuture = flight({ id: 3, date: '2026-12-05' });

    expect(
      find(
        buildFlightMilestones([past, target, laterFuture], target),
        'overall',
      )!.ordinal,
    ).toBe(2);

    const earlierFuture = flight({ id: 4, date: '2026-04-05' });
    expect(
      find(
        buildFlightMilestones(
          [past, earlierFuture, target, laterFuture],
          target,
        ),
        'overall',
      )!.ordinal,
    ).toBe(3);
  });

  it('is the first of everything in a single-flight scope', () => {
    const lone = flight({ id: 1 });
    expect(find(buildFlightMilestones([lone], lone), 'overall')!.ordinal).toBe(
      1,
    );
    expect(find(buildFlightMilestones([lone], lone), 'route')!.ordinal).toBe(1);
  });

  it('returns nothing when the flight is outside the scope', () => {
    const inScope = flight({ id: 1 });
    const elsewhere = flight({ id: 2 });
    expect(buildFlightMilestones([inScope], elsewhere)).toEqual([]);
  });

  it('emits milestones in registry order for a fully-populated flight', () => {
    const full = flight({
      id: 1,
      airline: airline(1, 'Emirates'),
      aircraft: aircraft(1, 'Boeing 777-300ER'),
      aircraftReg: 'A6-EQO',
      passengers: [
        passenger('me', { seatNumber: '3C', seatClass: 'business' }),
      ],
    });

    expect(keysOf(buildFlightMilestones([full], full))).toEqual([
      'overall',
      'route',
      'airline',
      'aircraft',
      'tail',
      'seat',
      'airport-from',
      'airport-to',
      'cabin-first',
    ]);
  });
});
