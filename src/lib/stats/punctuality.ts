import { parseISO } from 'date-fns';

import {
  codeForAirport,
  routeLabelForFlight,
  type FlightChartKey,
} from './aggregations';

import type { FlightData } from '$lib/utils';
import { orderNewestFirst } from '$lib/utils/data/flight-order';
import { Duration } from '$lib/utils/datetime';

/**
 * A flight is "delayed" once it arrives at least this many minutes behind
 * schedule — the 15-minute window the airline industry uses for on-time stats.
 */
export const DELAY_THRESHOLD_MINUTES = 15;

/**
 * Arrival delay in minutes (actual − scheduled), or null when the flight lacks
 * the scheduled/actual arrival timestamps needed to assess punctuality.
 */
export function arrivalDelayMinutes(flight: FlightData): number | null {
  const { arrivalScheduled, arrival } = flight.raw;
  if (!arrivalScheduled || !arrival) return null;

  const scheduled = parseISO(arrivalScheduled);
  const actual = parseISO(arrival);
  if (Number.isNaN(scheduled.getTime()) || Number.isNaN(actual.getTime())) {
    return null;
  }
  // Not rounded, so 15 minutes and 30 seconds counts as over the threshold.
  return (actual.getTime() - scheduled.getTime()) / 60_000;
}

type PunctualityGroup = {
  noun: string;
  plural: string;
  /** The ranked list whose row labels (logos, flags, names) this reuses. */
  labelKey: FlightChartKey;
  keyOf: (flight: FlightData) => string | null;
};

/** The ways delays are broken down, and which group a flight falls in. */
export const PUNCTUALITY_GROUPS = {
  airlines: {
    noun: 'airline',
    plural: 'airlines',
    labelKey: 'airlines',
    keyOf: (flight) => flight.airline?.name ?? 'Unknown airline',
  },
  routes: {
    noun: 'route',
    plural: 'routes',
    labelKey: 'routes',
    keyOf: routeLabelForFlight,
  },
  'departure-airports': {
    noun: 'departing airport',
    plural: 'departing airports',
    labelKey: 'airports',
    keyOf: (flight) => codeForAirport(flight.from),
  },
} satisfies Record<string, PunctualityGroup>;

export type PunctualityGroupKey = keyof typeof PUNCTUALITY_GROUPS;

export const isPunctualityGroupKey = (
  value: unknown,
): value is PunctualityGroupKey =>
  typeof value === 'string' && Object.hasOwn(PUNCTUALITY_GROUPS, value);

export type PunctualityEntry = {
  key: string;
  assessedFlights: number;
  delayedFlights: number;
  totalDelayMinutes: number;
  /** Mean minutes late across the group's delayed flights. */
  averageDelayMinutes: number;
  delayRate: number; // percentage of assessed flights that were delayed
};

export type FlightDelay = {
  flight: FlightData;
  delayMinutes: number;
};

export type PunctualityReport = {
  assessedFlights: number; // flights with usable scheduled + actual arrival
  delayedFlights: number;
  delayRate: number; // percentage of assessed flights delayed (0..100)
  totalDelayMinutes: number;
  worstDelayMinutes: number;
  earlyFlights: number;
  totalEarlyMinutes: number;
  bestEarlyMinutes: number;
  /** Groups with at least one delayed flight, most minutes lost first. */
  groups: Record<PunctualityGroupKey, PunctualityEntry[]>;
  /** Every delayed flight, most late first. */
  delays: FlightDelay[];
};

type GroupTally = { assessed: number; delayed: number; delayMinutes: number };

const GROUP_KEYS = Object.keys(PUNCTUALITY_GROUPS) as PunctualityGroupKey[];

export function punctualityReport(flights: FlightData[]): PunctualityReport {
  let assessedFlights = 0;
  let totalDelayMinutes = 0;
  let worstDelayMinutes = 0;
  let earlyFlights = 0;
  let totalEarlyMinutes = 0;
  let bestEarlyMinutes = 0;
  const delays: FlightDelay[] = [];
  const tallies = Object.fromEntries(
    GROUP_KEYS.map((group) => [group, new Map<string, GroupTally>()]),
  ) as Record<PunctualityGroupKey, Map<string, GroupTally>>;

  // Newest first, so flights and groups that tie keep the order every flight
  // list in the app shows.
  for (const flight of orderNewestFirst(flights, (f) => f.raw)) {
    const delay = arrivalDelayMinutes(flight);
    if (delay === null) continue;

    assessedFlights++;
    const delayed = delay > DELAY_THRESHOLD_MINUTES;
    if (delayed) {
      delays.push({ flight, delayMinutes: delay });
      totalDelayMinutes += delay;
      worstDelayMinutes = Math.max(worstDelayMinutes, delay);
    } else if (delay < 0) {
      earlyFlights++;
      totalEarlyMinutes -= delay;
      bestEarlyMinutes = Math.max(bestEarlyMinutes, -delay);
    }

    for (const group of GROUP_KEYS) {
      const key = PUNCTUALITY_GROUPS[group].keyOf(flight);
      if (key === null) continue;

      const tally = tallies[group].get(key) ?? {
        assessed: 0,
        delayed: 0,
        delayMinutes: 0,
      };
      tally.assessed++;
      if (delayed) {
        tally.delayed++;
        tally.delayMinutes += delay;
      }
      tallies[group].set(key, tally);
    }
  }

  const entriesOf = (group: PunctualityGroupKey): PunctualityEntry[] =>
    [...tallies[group]]
      .filter(([, tally]) => tally.delayed > 0)
      .map(([key, tally]) => ({
        key,
        assessedFlights: tally.assessed,
        delayedFlights: tally.delayed,
        totalDelayMinutes: tally.delayMinutes,
        averageDelayMinutes: tally.delayMinutes / tally.delayed,
        delayRate: (tally.delayed / tally.assessed) * 100,
      }))
      .sort((a, b) => b.totalDelayMinutes - a.totalDelayMinutes);

  return {
    assessedFlights,
    delayedFlights: delays.length,
    delayRate: assessedFlights ? (delays.length / assessedFlights) * 100 : 0,
    totalDelayMinutes,
    worstDelayMinutes,
    earlyFlights,
    totalEarlyMinutes,
    bestEarlyMinutes,
    groups: Object.fromEntries(
      GROUP_KEYS.map((group) => [group, entriesOf(group)]),
    ) as Record<PunctualityGroupKey, PunctualityEntry[]>,
    delays: delays.sort((a, b) => b.delayMinutes - a.delayMinutes),
  };
}

export const byAverageDelay = (entries: PunctualityEntry[]) =>
  [...entries].sort((a, b) => b.averageDelayMinutes - a.averageDelayMinutes);

export const formatDelay = (minutes: number) =>
  Duration.fromSeconds(Math.round(Math.abs(minutes)) * 60).toString(true);

/** Late reads as +, early as −, the way delays are usually spoken about. */
export const formatSignedDelay = (minutes: number) =>
  `${minutes < 0 ? '−' : '+'}${formatDelay(minutes)}`;
