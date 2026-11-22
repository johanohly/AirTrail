import { format, isValid } from 'date-fns';

import type { Flight } from '$lib/db/types';
import { resolveFlightTimeline } from '$lib/utils/data/flight-timeline';

export type MoveDirection = 'earlier' | 'later';

type Ranked = Pick<Flight, 'id' | 'sortKey'>;
type Timeless = Pick<
  Flight,
  | 'date'
  | 'datePrecision'
  | 'departure'
  | 'takeoffActual'
  | 'departureScheduled'
  | 'takeoffScheduled'
>;

/** Gap between two keys below which a move renumbers the bucket instead. */
const MIN_KEY_GAP = 1e-6;

const PRECISION_RANK = { day: 0, month: 1, year: 2 } as const;

/** Place among flights that tie on date: a moved flight's key, else its id. */
export const flightRank = ({ id, sortKey }: Ranked) => sortKey ?? id;

/** Mirrors `resolveFlightTimeline`: a recorded departure only counts on a day. */
export const hasDepartureTime = (flight: Timeless) =>
  Boolean(
    (flight.datePrecision === 'day' && flight.departure) ||
    flight.takeoffActual ||
    flight.departureScheduled ||
    flight.takeoffScheduled,
  );

/** The first day a flight's date covers, as `yyyy-MM-dd`. */
const calendarDay = ({ date, datePrecision }: Timeless) => {
  const [year, month = '01', day = '01'] = date.split('-');
  if (datePrecision === 'year') return `${year}-01-01`;
  if (datePrecision === 'month') return `${year}-${month}-01`;
  return `${year}-${month}-${day}`;
};

/**
 * Flights in one bucket can only be told apart by their order, so they are the
 * ones a person can move among each other. Imports may store any day for a
 * flight known only to the month, so the date is compared at its precision.
 */
export const moveBucket = (flight: Timeless) =>
  hasDepartureTime(flight)
    ? null
    : `${calendarDay(flight)}|${flight.datePrecision}`;

type Keyed<T> = {
  item: T;
  at: number;
  day: string;
  precision: number;
  rank: number;
  id: number;
};

const newer = <V extends number | string>(a: V, b: V) =>
  a > b ? -1 : a < b ? 1 : 0;
const byRank = <T>(a: Keyed<T>, b: Keyed<T>) =>
  newer(a.rank, b.rank) || newer(a.id, b.id);

/*
 * Sorts newest first on the best known departure time. Actual times are only
 * recorded once a flight has been flown, so upcoming ones have to be ordered on
 * their scheduled time rather than on the start of their day.
 *
 * Flights without any time are ordered among themselves on their calendar date
 * and then on their rank, so flights logged with only a month keep the order
 * they were entered or moved in. Their start of day falls at a different
 * instant in every timezone, which would otherwise order them on where they
 * departed from. Flights known to the month sit above those known to the day on
 * the same first day, so each bucket stays together. They are then merged with
 * the timed flights on the local departure date, and on the start of their day
 * within one date. Flights without any usable date sink to the bottom.
 */
export const orderNewestFirst = <T>(
  items: readonly T[],
  flightOf: (item: T) => Flight,
): T[] => {
  const timed: Keyed<T>[] = [];
  const untimed: Keyed<T>[] = [];
  const undated: Keyed<T>[] = [];

  for (const item of items) {
    const flight = flightOf(item);
    const { effectiveDeparture, dateStart } = resolveFlightTimeline(flight);
    const keyed = {
      item,
      precision: PRECISION_RANK[flight.datePrecision] ?? 0,
      rank: flightRank(flight),
      id: flight.id,
    };
    if (effectiveDeparture) {
      timed.push({
        ...keyed,
        at: effectiveDeparture.getTime(),
        day: isValid(effectiveDeparture)
          ? format(effectiveDeparture, 'yyyy-MM-dd')
          : '',
      });
    } else if (dateStart) {
      untimed.push({
        ...keyed,
        at: dateStart.getTime(),
        day: calendarDay(flight),
      });
    } else {
      undated.push({ ...keyed, at: 0, day: '' });
    }
  }

  timed.sort((a, b) => newer(a.at, b.at) || byRank(a, b));
  untimed.sort(
    (a, b) =>
      newer(a.day, b.day) || newer(a.precision, b.precision) || byRank(a, b),
  );
  undated.sort(byRank);

  // A bucket's start of day differs per departure timezone, so its flights
  // share the latest one, or a timed flight could land between them.
  const bucketStart = new Map<string, number>();
  for (const { day, precision, at } of untimed) {
    const bucket = `${day}|${precision}`;
    bucketStart.set(bucket, Math.max(bucketStart.get(bucket) ?? at, at));
  }
  for (const keyed of untimed) {
    keyed.at = bucketStart.get(`${keyed.day}|${keyed.precision}`) ?? keyed.at;
  }

  const isOlder = (a: Keyed<T>, b: Keyed<T>) =>
    (newer(a.day, b.day) || newer(a.at, b.at)) > 0;

  const sorted: T[] = [];
  let i = 0;
  let j = 0;
  while (i < timed.length || j < untimed.length) {
    const nextTimed = timed[i];
    const nextUntimed = untimed[j];
    if (nextTimed && (!nextUntimed || !isOlder(nextTimed, nextUntimed))) {
      sorted.push(nextTimed.item);
      i++;
    } else if (nextUntimed) {
      sorted.push(nextUntimed.item);
      j++;
    }
  }

  return [...sorted, ...undated.map(({ item }) => item)];
};

export type MoveOptions = Record<MoveDirection, boolean>;

/**
 * Which ways each flight in `ordered` (newest first) can move: only past
 * another flight of its bucket, so a flight alone in its bucket is left out.
 */
export const listMoveOptions = (
  ordered: readonly Flight[],
): Map<number, MoveOptions> => {
  const totals = new Map<string, number>();
  const buckets = ordered.map(moveBucket);
  for (const bucket of buckets) {
    if (bucket) totals.set(bucket, (totals.get(bucket) ?? 0) + 1);
  }

  const seen = new Map<string, number>();
  const options = new Map<number, MoveOptions>();
  ordered.forEach((flight, index) => {
    const bucket = buckets[index];
    if (!bucket) return;
    const above = seen.get(bucket) ?? 0;
    seen.set(bucket, above + 1);
    const below = (totals.get(bucket) ?? 0) - above - 1;
    if (above || below) {
      options.set(flight.id, { later: above > 0, earlier: below > 0 });
    }
  });
  return options;
};

/**
 * The sort keys to write to move flight `id` one place within `bucket`, which
 * holds its bucket newest first. Usually only the moved flight changes: it
 * takes the midpoint between the neighbour it passes and the flight beyond, or
 * one past the neighbour at the end. When that gap has been halved too often,
 * the whole bucket is renumbered. Null when the flight can't move that way.
 */
export const planMove = (
  bucket: readonly Ranked[],
  id: number,
  direction: MoveDirection,
): Map<number, number> | null => {
  const index = bucket.findIndex((flight) => flight.id === id);
  const step = direction === 'earlier' ? 1 : -1;
  const neighbour = bucket[index + step];
  if (index === -1 || !neighbour) return null;

  const beyond = bucket[index + 2 * step];
  const passed = flightRank(neighbour);
  if (!beyond) return new Map([[id, passed - step]]);

  const next = flightRank(beyond);
  if (Math.abs(passed - next) >= MIN_KEY_GAP) {
    return new Map([[id, (passed + next) / 2]]);
  }

  const moved = bucket.filter((flight) => flight.id !== id);
  moved.splice(index + step, 0, bucket[index]!);
  const base = Math.floor(Math.min(...bucket.map(flightRank)));
  return new Map(
    moved.map((flight, position) => [
      flight.id,
      base + moved.length - 1 - position,
    ]),
  );
};
