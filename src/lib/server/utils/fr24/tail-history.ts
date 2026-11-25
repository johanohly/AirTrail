import { tz } from '@date-fns/tz';
import { startOfDay } from 'date-fns';
import { APIClient } from 'flightradarapi';

import {
  earlierPage,
  locateBoardPage,
  pageBudget,
  readBoardPage,
} from './boards';
import {
  MAX_BOARD_PAGES,
  flightListAvailable,
  noteFlightListFailure,
} from './flight-lookup';
import { parseLeg, type FR24Leg } from './parse';

// Same TLS-impersonation client the wrapper uses internally. We point it at
// FR24's flight/list endpoint, which the typed wrapper doesn't expose.
const client = new APIClient();

const FR24_FLIGHT_LIST =
  'https://api.flightradar24.com/common/v1/flight/list.json';

// How many recent flights to ask for at a time. 25 is the FR24 page default
// and is far more than a single same-day rotation should ever need.
const TAIL_HISTORY_LIMIT = 25;

// Hard cap on returned legs, kept symmetric with the old arrivals-walk
// implementation. Even at major hubs, an aircraft will not fly more than ~12
// rotations in one calendar day.
const MAX_HISTORY_LEGS = 12;

// Rotation cache for the arrivals-board walk, keyed by tail + the user's leg.
// A different tail (aircraft swap) is a different key, so it rebuilds from
// scratch. With the same tail, a refresh re-walks only the legs that have not
// landed yet and reuses the landed ones, which can no longer change. That
// also keeps early legs that have since aged off FR24's boards.
const RESULT_TTL_MS = 60 * 1000; // serve as-is inside this window
const CHAIN_MAX_AGE_MS = 36 * 3600 * 1000; // keep for reuse this long
const chainCache = new Map<string, { at: number; legs: FR24Leg[] }>();
const inFlight = new Map<string, Promise<FR24Leg[]>>();

function startOfTodayUnixAtTz(originTz: string, referenceMs: number): number {
  const reference = new Date(referenceMs);
  const localMidnight = startOfDay(reference, { in: tz(originTz) });
  return Math.floor(localMidnight.getTime() / 1000);
}

/**
 * Return today's legs flown (or to be flown) by `tail` before `beforeTs`, in
 * chronological order (earliest first). "Today" starts at local midnight in
 * the user's origin timezone.
 *
 * Primary source: flight/list?fetchBy=reg (one request, complete history).
 * When that endpoint is blocked or fails, and `originIata` is given, rebuild
 * the rotation by walking arrivals boards backward from the user's origin:
 * find the tail's latest arrival at the origin before `beforeTs`, then the
 * tail's latest arrival at THAT leg's origin before its departure, and so on
 * until local midnight.
 */
export async function getTailHistoryToday(
  tail: string,
  beforeTs: number,
  originTz: string,
  originIata?: string,
): Promise<FR24Leg[]> {
  const dayStart = startOfTodayUnixAtTz(originTz, beforeTs * 1000);

  if (flightListAvailable()) {
    const legs = await fromFlightList(tail, beforeTs, dayStart);
    if (legs) return legs;
  }
  if (!originIata) return [];

  const key = `${tail}|${originIata}|${beforeTs}`;
  const cached = chainCache.get(key);
  if (cached && Date.now() - cached.at < RESULT_TTL_MS) return cached.legs;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const run = walkRotation(
    tail,
    originIata,
    beforeTs,
    dayStart,
    cached?.legs ?? [],
  )
    .then((legs) => {
      chainCache.set(key, { at: Date.now(), legs });
      pruneChains();
      return legs;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, run);
  return run;
}

/** flight/list lookup. Returns null when the request fails (caller falls back). */
async function fromFlightList(
  tail: string,
  beforeTs: number,
  dayStart: number,
): Promise<FR24Leg[] | null> {
  const url =
    `${FR24_FLIGHT_LIST}?query=${encodeURIComponent(tail)}` +
    `&fetchBy=reg&page=1&limit=${TAIL_HISTORY_LIMIT}`;

  let response: { statusCode: number; content: any };
  try {
    response = await client.request(url);
  } catch (err) {
    noteFlightListFailure(err);
    console.error(
      `[fr24] flight/list?reg=${tail} failed:`,
      (err as Error)?.message ?? err,
    );
    return null;
  }
  if (response.statusCode !== 200) return null;

  const rows: unknown[] = response.content?.result?.response?.data ?? [];
  return rows
    .map((row) => parseLeg(row))
    .filter((leg) => {
      const sched = leg.schedDep;
      return !!sched && sched < beforeTs && sched >= dayStart;
    })
    .sort((a, b) => (a.schedDep ?? 0) - (b.schedDep ?? 0))
    .slice(-MAX_HISTORY_LEGS);
}

/**
 * Walk the rotation backward, newest leg first. `previous` is the last result
 * for this same tail + leg: once a freshly walked leg matches a cached leg
 * whose earlier legs have all landed, splice those in and stop.
 */
async function walkRotation(
  tail: string,
  originIata: string,
  beforeTs: number,
  dayStart: number,
  previous: FR24Leg[],
): Promise<FR24Leg[]> {
  const walked: FR24Leg[] = []; // newest first
  let older: FR24Leg[] = [];
  let airport: string | null = originIata;
  let before = beforeTs;
  let spliced = false;

  while (airport && walked.length < MAX_HISTORY_LEGS) {
    const leg = await findInbound(tail, airport, before, dayStart);
    if (!leg || leg.schedDep == null || leg.schedDep < dayStart) break;
    walked.push(leg);

    const i = previous.findIndex((p) => sameLeg(p, leg));
    if (i >= 0 && previous.slice(0, i).every(isFinal)) {
      older = previous.slice(0, i);
      spliced = true;
      break;
    }

    airport = leg.origin;
    before = leg.schedDep;
  }

  // Walk stopped early without reaching cached legs (a leg aged off the
  // board, or a fetch failed): keep any cached legs older than what we found.
  if (!spliced && previous.length > 0) {
    const cutoff = walked.length
      ? (walked[walked.length - 1]!.schedDep ?? before)
      : beforeTs;
    older = previous.filter((p) => (p.schedDep ?? 0) < cutoff);
  }

  return [...older, ...walked.reverse()]
    .filter((leg) => (leg.schedDep ?? 0) >= dayStart)
    .slice(-MAX_HISTORY_LEGS);
}

/**
 * Find the tail's latest scheduled arrival at `airport` before `before`:
 * jump to the arrivals page containing `before`, then step earlier until a
 * match turns up, local midnight is passed, or the page budget is spent.
 */
async function findInbound(
  tail: string,
  airport: string,
  before: number,
  dayStart: number,
): Promise<FR24Leg | null> {
  const budget = pageBudget(MAX_BOARD_PAGES);
  const arrival = (leg: FR24Leg) => leg.schedArr ?? leg.schedDep;
  const isInbound = (leg: FR24Leg) => {
    const t = arrival(leg);
    return leg.tail === tail && t != null && t < before;
  };
  const latest = (legs: FR24Leg[]) =>
    legs.reduce((a, b) => ((arrival(b) ?? 0) > (arrival(a) ?? 0) ? b : a));

  const located = await locateBoardPage(airport, 'arrivals', before, budget);
  if (!located) return null;

  let { page, legs } = located;
  for (;;) {
    const matches = legs.filter(isInbound);
    if (matches.length > 0) return latest(matches);

    const times = legs.map(arrival).filter((t): t is number => t != null);
    if (times.length === 0 || Math.min(...times) < dayStart) return null;

    page = earlierPage(page);
    const read = await readBoardPage(airport, 'arrivals', page, budget);
    if (!read || read.legs.length === 0) return null;
    legs = read.legs;
  }
}

function sameLeg(a: FR24Leg, b: FR24Leg): boolean {
  return (
    a.flightNumber === b.flightNumber &&
    a.origin === b.origin &&
    a.schedDep === b.schedDep
  );
}

/** Landed legs can't change, so a refresh doesn't need to re-fetch them. */
function isFinal(leg: FR24Leg): boolean {
  return leg.realArr != null || /^landed/i.test(leg.status);
}

function pruneChains(): void {
  const cutoff = Date.now() - CHAIN_MAX_AGE_MS;
  for (const [k, v] of chainCache) if (v.at < cutoff) chainCache.delete(k);
}
