import { FlightRadar24API } from 'flightradarapi';

import { parseLeg, type FR24Leg } from './parse';

// Single shared client instance. Stateless — safe to reuse across requests.
const client = new FlightRadar24API();

export type Board = 'departures' | 'arrivals';

// Page-size used when calling FR24. Matches the airport.json default. The Python
// prototype passed page= without a limit; specifying both makes the request
// behavior explicit and trims allocations when pages come back full.
const FLIGHT_LIMIT_PER_PAGE = 100;

// One airport.json response carries BOTH boards, so cache the raw response per
// (airport, page) and serve departures and arrivals from it. Board pages are
// relative to "now", so keep the TTL short. Concurrent callers share one
// in-flight request. Failures are not cached.
const PAGE_TTL_MS = 60 * 1000;
const pageCache = new Map<string, { at: number; details: Promise<any> }>();

function fetchAirportPage(airportIata: string, page: number): Promise<any> {
  const key = `${airportIata}|${page}`;
  const hit = pageCache.get(key);
  if (hit && Date.now() - hit.at < PAGE_TTL_MS) return hit.details;

  const details = client
    .getAirportDetails(airportIata, FLIGHT_LIMIT_PER_PAGE, page)
    .catch((err: unknown) => {
      pageCache.delete(key);
      throw err;
    });
  pageCache.set(key, { at: Date.now(), details });

  if (pageCache.size > 500) {
    const cutoff = Date.now() - PAGE_TTL_MS;
    for (const [k, v] of pageCache) if (v.at < cutoff) pageCache.delete(k);
  }
  return details;
}

/** True when this page is served from cache (no FR24 call needed). */
export function isBoardPageCached(airportIata: string, page: number): boolean {
  const hit = pageCache.get(`${airportIata}|${page}`);
  return !!hit && Date.now() - hit.at < PAGE_TTL_MS;
}

type BoardRead = { legs: FR24Leg[]; totalPages: number | null };

async function readBoard(
  airportIata: string,
  board: Board,
  page: number,
): Promise<BoardRead> {
  let details: any;
  try {
    details = await fetchAirportPage(airportIata, page);
  } catch (err) {
    console.error(
      `[fr24] getAirportDetails(${airportIata}, page=${page}) failed:`,
      (err as Error)?.message ?? err,
    );
    return { legs: [], totalPages: null };
  }

  const schedule = details?.airport?.pluginData?.schedule?.[board];
  const rows: unknown[] = schedule?.data ?? [];
  const legs = rows.map((row) => {
    const leg = parseLeg((row as any)?.flight);
    return board === 'departures'
      ? { ...leg, origin: leg.origin ?? airportIata }
      : { ...leg, destination: leg.destination ?? airportIata };
  });
  const total = Number(schedule?.page?.total);
  return { legs, totalPages: Number.isFinite(total) ? total : null };
}

// Fetch one page of an airport's arrivals or departures board.
// Returns parsed legs (one per row). Returns [] on API error or when the page
// is empty so callers can stop paging without needing to handle exceptions.
//
// Board rows omit the board's own airport (departures rows have no origin,
// arrivals rows have no destination); it is filled in here.
//
// Positive pages run forward from "now" (ascending time); negative pages run
// backward from "now" (descending time).
export async function getBoardPage(
  airportIata: string,
  board: Board,
  page: number,
): Promise<FR24Leg[]> {
  return (await readBoard(airportIata, board, page)).legs;
}

// ---------------------------------------------------------------------------
// Budgeted, time-targeted board search.
//
// A board page is 100 rows, which is ~1 h at DEN/ATL but ~6 h at DAL, so
// stepping one page at a time can't reach "this evening" at a hub within a
// small budget. locateBoardPage jumps by the observed time span per page
// instead, landing on the right page in ~2-3 fetches.
// ---------------------------------------------------------------------------

/** Pause between uncached fetches inside one search, to avoid bursts. */
const BOARD_PAGE_DELAY_MS = 250;

/** Max FR24 page fetches per search; cached pages don't count. */
export type PageBudget = { left: number; fetched: number };
export const pageBudget = (pages: number): PageBudget => ({
  left: pages,
  fetched: 0,
});

/** The timestamp a board is ordered by: departures by sched dep, arrivals by sched arr. */
export function boardTime(leg: FR24Leg, board: Board): number | null {
  return board === 'departures' ? leg.schedDep : (leg.schedArr ?? leg.schedDep);
}

/** Read a page, charging the budget unless cached. Null when the budget is spent. */
export async function readBoardPage(
  airportIata: string,
  board: Board,
  page: number,
  budget: PageBudget,
): Promise<BoardRead | null> {
  const cached = isBoardPageCached(airportIata, page);
  if (!cached) {
    if (budget.left <= 0) return null;
    if (budget.fetched > 0) await sleep(BOARD_PAGE_DELAY_MS);
    budget.left--;
    budget.fetched++;
  }
  return readBoard(airportIata, board, page);
}

/** The page just later in time (page 1 and -1 both start at "now"). */
export const laterPage = (p: number) => (p === -1 ? 1 : p + 1);
/** The page just earlier in time. */
export const earlierPage = (p: number) => (p === 1 ? -1 : p - 1);

/**
 * Find the page whose time range contains `ts`, or the closest page reached
 * within the budget. Returns null if nothing could be read.
 */
export async function locateBoardPage(
  airportIata: string,
  board: Board,
  ts: number,
  budget: PageBudget,
): Promise<{ page: number; legs: FR24Leg[] } | null> {
  const nowS = Math.floor(Date.now() / 1000);
  let page = ts >= nowS ? 1 : -1;
  let best: { page: number; legs: FR24Leg[] } | null = null;
  const tried = new Set<number>();

  while (!tried.has(page)) {
    tried.add(page);
    const read = await readBoardPage(airportIata, board, page, budget);
    if (!read) break; // budget spent

    if (read.legs.length === 0) {
      // Ran past the end of the board: step back toward "now".
      if (best || page === 1 || page === -1) break;
      page = page > 0 ? page - 1 : page + 1;
      continue;
    }

    const times = read.legs
      .map((leg) => boardTime(leg, board))
      .filter((t): t is number => t != null);
    best = { page, legs: read.legs };
    if (times.length === 0) break;
    const lo = Math.min(...times);
    const hi = Math.max(...times);
    if (ts >= lo && ts <= hi) break;

    const span = Math.max(hi - lo, 600);
    const total = read.totalPages ?? Infinity;
    if (page > 0) {
      if (ts > hi) page = Math.min(page + Math.ceil((ts - hi) / span), total);
      else if (page === 1) break;
      else page = Math.max(page - Math.ceil((lo - ts) / span), 1);
    } else {
      if (ts < lo) page = Math.max(page - Math.ceil((lo - ts) / span), -total);
      else if (page === -1) break;
      else page = Math.min(page + Math.ceil((ts - hi) / span), -1);
    }
  }
  return best;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
