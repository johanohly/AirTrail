import { APIClient, CloudflareError } from 'flightradarapi';

import {
  earlierPage,
  laterPage,
  locateBoardPage,
  pageBudget,
  readBoardPage,
  type Board,
} from './boards';
import { parseLeg, type FR24Leg } from './parse';

// Direct hit against FR24's flight/list endpoint. The typed FlightRadar24API
// wrapper doesn't expose this endpoint, but the underlying APIClient does
// (with Cloudflare TLS impersonation baked in — same client tail-history uses).
const client = new APIClient();

const FR24_FLIGHT_LIST =
  'https://api.flightradar24.com/common/v1/flight/list.json';

// FR24's default page size. 25 rows typically covers ~1 week of same-flight-
// number instances across all routes that flight number serves, which is more
// than enough context to disambiguate today's user leg.
const FLIGHT_LOOKUP_LIMIT = 25;

// FR24 puts flight/list behind a Cloudflare managed challenge at times, while
// airport.json (the board endpoint) stays reachable. After a challenge, skip
// flight/list for this long and go straight to the board walk, so we don't
// keep re-poking an endpoint that is refusing us.
const FLIGHT_LIST_COOLDOWN_MS = 30 * 60 * 1000;
let flightListBlockedUntil = 0;

/** False while flight/list is in its post-challenge cooldown. Shared with tail-history. */
export function flightListAvailable(): boolean {
  return Date.now() >= flightListBlockedUntil;
}

/** Record a flight/list failure; a Cloudflare challenge starts the cooldown. */
export function noteFlightListFailure(err: unknown): void {
  if (!(err instanceof CloudflareError)) return;
  if (flightListAvailable()) {
    console.warn(
      `[fr24] flight/list challenged by Cloudflare; skipping it for ` +
        `${FLIGHT_LIST_COOLDOWN_MS / 60000} min`,
    );
  }
  flightListBlockedUntil = Date.now() + FLIGHT_LIST_COOLDOWN_MS;
}

// Max FR24 board-page fetches per board search (cached pages are free).
// locateBoardPage jumps straight to the right page, so 6 covers a whole
// board even at hubs where one page is only ~1 h.
export const MAX_BOARD_PAGES = 6;

// Live status is a day-of feature: skip the board walk for flights more than
// this far from now (the route already limits to <= 24 h ahead).
const DAY_OF_WINDOW_S = 24 * 3600;

// Short result cache. The live-status UI can fire several getRotation calls
// in a few seconds (mount, refetch, multiple flights); without this each one
// hits FR24 again, and bursts are what get clients challenged. Kept at 60 s so
// a manual refresh still shows fresh delays.
const RESULT_TTL_MS = 60 * 1000;
const resultCache = new Map<string, { at: number; leg: FR24Leg | null }>();

/**
 * Locate a specific flight instance by number, origin, destination, and
 * scheduled departure time.
 *
 * Primary source: FR24's flight/list endpoint (one request). If that is
 * blocked or fails, fall back to walking the origin departures board, then
 * the destination arrivals board (airport.json, via getBoardPage).
 *
 * flight/list returns all recent + upcoming instances of `flightNumber`
 * across every route it serves. Many airlines (notably Southwest) reuse
 * flight numbers for unrelated routes on the same day, and every airline
 * repeats the same route day after day — so a raw response is a mix of:
 *
 *   - the exact flight we want
 *   - same route, different days (yesterday, tomorrow, ...)
 *   - same day, different routes (WN1563 IND→MCI when we want AUS→MCI)
 *   - stale historical entries from previous months
 *
 * Filter by origin+destination match, then pick the instance whose
 * scheduled departure is closest to the user's target.
 *
 * Returns null when no matching row is found by either source — caller
 * renders the "not tracked by FR24" empty state.
 */
export async function findFlightInstance(
  flightNumber: string,
  originIata: string,
  destinationIata: string,
  targetSchedDepTs: number,
): Promise<FR24Leg | null> {
  const key = `${flightNumber}|${originIata}|${destinationIata}|${targetSchedDepTs}`;
  const cached = resultCache.get(key);
  if (cached && Date.now() - cached.at < RESULT_TTL_MS) return cached.leg;

  let leg = await fromFlightList(
    flightNumber,
    originIata,
    destinationIata,
    targetSchedDepTs,
  );
  if (leg === undefined) {
    leg = await fromBoards(
      flightNumber,
      originIata,
      destinationIata,
      targetSchedDepTs,
    );
  }

  resultCache.set(key, { at: Date.now(), leg });
  pruneCache();
  return leg;
}

/**
 * flight/list lookup.
 * Returns the matched leg, null when the request worked but nothing matched,
 * or undefined when the request failed (caller should fall back).
 */
async function fromFlightList(
  flightNumber: string,
  originIata: string,
  destinationIata: string,
  targetSchedDepTs: number,
): Promise<FR24Leg | null | undefined> {
  if (!flightListAvailable()) return undefined;

  const url =
    `${FR24_FLIGHT_LIST}?query=${encodeURIComponent(flightNumber)}` +
    `&fetchBy=flight&page=1&limit=${FLIGHT_LOOKUP_LIMIT}`;

  let response: { statusCode: number; content: any };
  try {
    response = await client.request(url);
  } catch (err) {
    if (err instanceof CloudflareError) {
      noteFlightListFailure(err);
    } else {
      console.error(
        `[fr24] flight/list?flight=${flightNumber} failed:`,
        (err as Error)?.message ?? err,
      );
    }
    return undefined;
  }
  if (response.statusCode !== 200) return undefined;

  const rows: unknown[] = response.content?.result?.response?.data ?? [];
  const legs = rows.map((row) => parseLeg(row));
  return pickClosest(legs, originIata, destinationIata, targetSchedDepTs);
}

/**
 * Board-walk fallback: origin departures first, then destination arrivals.
 * Pages forward for future flights and backward (negative pages) for past
 * ones, stopping once a page reaches past the target time.
 */
async function fromBoards(
  flightNumber: string,
  originIata: string,
  destinationIata: string,
  targetSchedDepTs: number,
): Promise<FR24Leg | null> {
  const nowS = Math.floor(Date.now() / 1000);
  if (Math.abs(targetSchedDepTs - nowS) > DAY_OF_WINDOW_S) return null;

  const wanted = normalizeFlightNumber(flightNumber);
  const plan: Array<[string, Board]> = [
    [originIata, 'departures'],
    [destinationIata, 'arrivals'],
  ];

  for (const [airport, board] of plan) {
    const found = await walkBoard(
      airport,
      board,
      wanted,
      originIata,
      destinationIata,
      targetSchedDepTs,
    );
    if (found) return found;
  }
  return null;
}

async function walkBoard(
  airport: string,
  board: Board,
  wantedFlightNumber: string,
  originIata: string,
  destinationIata: string,
  targetSchedDepTs: number,
): Promise<FR24Leg | null> {
  const budget = pageBudget(MAX_BOARD_PAGES);
  const isWanted = (leg: FR24Leg) =>
    normalizeFlightNumber(leg.flightNumber) === wantedFlightNumber;

  // Departures are ordered by sched dep, so the target time is on the
  // located page (or a neighbor). Arrivals are ordered by arrival, which is
  // later than the departure we know, so after the located page look later.
  const located = await locateBoardPage(
    airport,
    board,
    targetSchedDepTs,
    budget,
  );
  if (!located) return null;

  let found = pickClosest(
    located.legs.filter(isWanted),
    originIata,
    destinationIata,
    targetSchedDepTs,
  );
  const neighbors: number[] = [];
  if (board === 'departures') {
    neighbors.push(laterPage(located.page), earlierPage(located.page));
  } else {
    let p = located.page;
    for (let i = 0; i < MAX_BOARD_PAGES; i++)
      neighbors.push((p = laterPage(p)));
  }

  for (const page of neighbors) {
    if (found) break;
    const read = await readBoardPage(airport, board, page, budget);
    if (!read || read.legs.length === 0) break;
    found = pickClosest(
      read.legs.filter(isWanted),
      originIata,
      destinationIata,
      targetSchedDepTs,
    );
  }
  return found;
}

function pickClosest(
  legs: FR24Leg[],
  originIata: string,
  destinationIata: string,
  targetSchedDepTs: number,
): FR24Leg | null {
  const candidates = legs.filter(
    (leg) =>
      leg.origin === originIata &&
      leg.destination === destinationIata &&
      leg.schedDep != null,
  );
  if (candidates.length === 0) return null;

  return candidates.sort(
    (a, b) =>
      Math.abs((a.schedDep ?? 0) - targetSchedDepTs) -
      Math.abs((b.schedDep ?? 0) - targetSchedDepTs),
  )[0]!;
}

function normalizeFlightNumber(n: string): string {
  return n.replace(/\s+/g, '').toUpperCase();
}

function pruneCache(): void {
  if (resultCache.size < 200) return;
  const cutoff = Date.now() - RESULT_TTL_MS;
  for (const [k, v] of resultCache) if (v.at < cutoff) resultCache.delete(k);
}
