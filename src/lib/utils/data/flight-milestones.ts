import type { FlightData } from './data';

import type { FlightPassenger } from '$lib/db/types';
import { codeForAirport, routeLabelForFlight } from '$lib/stats/aggregations';
import { toTitleCase } from '$lib/utils';

export type FlightMilestoneKey =
  | 'overall'
  | 'route'
  | 'airline'
  | 'aircraft'
  | 'tail'
  | 'seat'
  | 'airport-from'
  | 'airport-to'
  | 'cabin-first';

export type FlightMilestone = {
  key: FlightMilestoneKey;
  ordinal: number;
  label: string;
  firstOnly?: boolean;
};

type MilestoneContext = { seatUserId: string | null };

type DimensionDef = {
  key: FlightMilestoneKey;
  /** Emit the milestone only when it is the traveller's first. */
  firstOnly?: boolean;
  /** The bucket the flight belongs to for this dimension; null skips it. */
  groupOf: (f: FlightData, ctx: MilestoneContext) => string | null;
  /** Whether another flight shares the bucket; defaults to `groupOf(g) === group`. */
  matches?: (g: FlightData, group: string, ctx: MilestoneContext) => boolean;
  labelFor: (f: FlightData, ctx: MilestoneContext, ordinal: number) => string;
};

export const formatOrdinal = (n: number): string => {
  // Teens (11th–13th) are the classic exception to the 1/2/3 suffix rule.
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
};

/**
 * The passenger whose seats and cabins this flight pane is scoped to. When a
 * user id is given, only that passenger counts; without one, only a flight
 * with exactly one passenger is attributable.
 */
export const scopedPassengerOf = (
  f: FlightData,
  ctx: MilestoneContext,
): FlightPassenger | null => {
  if (ctx.seatUserId) {
    return f.passengers.find((p) => p.userId === ctx.seatUserId) ?? null;
  }
  return f.passengers.length === 1 ? (f.passengers[0] ?? null) : null;
};

const OVERALL_GROUP = '__all__';

const airportVisitMatches = (g: FlightData, group: string) =>
  String(g.from?.id) === group || String(g.to?.id) === group;

/**
 * Declarative registry of the dimensions milestones are counted over. The
 * array order is the order milestones are emitted in.
 */
export const DIMENSIONS: readonly DimensionDef[] = [
  {
    key: 'overall',
    groupOf: () => OVERALL_GROUP,
    labelFor: () => 'flight',
  },
  {
    key: 'airport-from',
    groupOf: (f) => (f.from ? String(f.from.id) : null),
    // Any arrival or departure counts as one visit to the airport,
    // regardless of direction; a same-airport flight still counts once.
    matches: airportVisitMatches,
    // The pane prefixes the ordinal ("3rd"), so the label carries the
    // singular noun the ordinal binds to: "3rd time at LHR".
    labelFor: (f) => `time at ${codeForAirport(f.from)}`,
  },
  {
    key: 'airport-to',
    groupOf: (f) => (f.to ? String(f.to.id) : null),
    matches: airportVisitMatches,
    labelFor: (f) => `time at ${codeForAirport(f.to)}`,
  },
  {
    key: 'route',
    groupOf: (f) => routeLabelForFlight(f),
    labelFor: (f) => `flight ${routeLabelForFlight(f)}`,
  },
  {
    key: 'airline',
    groupOf: (f) => (f.airline ? String(f.airline.id) : null),
    labelFor: (f) => `flight by ${f.airline!.name}`,
  },
  {
    key: 'aircraft',
    groupOf: (f) => (f.aircraft ? String(f.aircraft.id) : null),
    labelFor: (f) => `flight on ${f.aircraft!.name}`,
  },
  {
    key: 'tail',
    groupOf: (f) => f.aircraftReg?.trim() || null,
    labelFor: (f) => `flight on ${f.aircraftReg!.trim()}`,
  },
  {
    key: 'seat',
    groupOf: (f, ctx) => scopedPassengerOf(f, ctx)?.seatNumber?.trim() || null,
    labelFor: (f, ctx) => {
      const passenger = scopedPassengerOf(f, ctx);
      return `flight on seat ${passenger?.seatNumber?.trim()}`;
    },
  },
  {
    key: 'cabin-first',
    firstOnly: true,
    groupOf: (f, ctx) => scopedPassengerOf(f, ctx)?.seatClass ?? null,
    labelFor: (f, ctx) =>
      `First in ${toTitleCase(scopedPassengerOf(f, ctx)?.seatClass ?? '')}`,
  },
];

export const buildFlightMilestones = (
  flights: FlightData[],
  flight: FlightData,
  opts: { seatUserId?: string | null } = {},
): FlightMilestone[] => {
  const ctx: MilestoneContext = { seatUserId: opts.seatUserId ?? null };

  // Order the scope chronologically. Sorting by the TOTAL order — departure
  // timestamp first, then id — gives same-timestamp flights a stable
  // tiebreak, so two flights leaving at the same instant can never both
  // claim "1st".
  const sorted = [...flights].sort(
    (a, b) =>
      (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0) || a.id - b.id,
  );
  const targetIndex = sorted.findIndex((f) => f.id === flight.id);
  if (targetIndex === -1) return [];

  const milestones: FlightMilestone[] = [];
  for (const dimension of DIMENSIONS) {
    const group = dimension.groupOf(flight, ctx);
    if (group === null) continue;

    const matches: DimensionDef['matches'] =
      dimension.matches ??
      ((g, candidateGroup, scoped) =>
        dimension.groupOf(g, scoped) === candidateGroup);

    // Walk the sorted scope up to and including the target; the `<=` is on
    // the total order, so the flight itself always matches and its id
    // settles ties against any flight sharing its timestamp.
    let ordinal = 0;
    for (let i = 0; i <= targetIndex; i++) {
      if (matches(sorted[i]!, group, ctx)) ordinal++;
    }

    if (dimension.firstOnly && ordinal !== 1) continue;
    milestones.push({
      key: dimension.key,
      ordinal,
      label: dimension.labelFor(flight, ctx, ordinal),
      ...(dimension.firstOnly ? { firstOnly: true } : {}),
    });
  }
  return milestones;
};
