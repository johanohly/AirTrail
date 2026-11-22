import { format, isValid } from 'date-fns';

import type { Flight } from '$lib/db/types';
import { distanceBetween, type FlightData } from '$lib/utils';
import {
  isCompletedFlight,
  resolveFlightTimeline,
} from '$lib/utils/data/flight-timeline';

/** Ground time under which two legs still read as one trip rather than two. */
export const MAX_LAYOVER_HOURS = 12;

const MAX_LAYOVER_MS = MAX_LAYOVER_HOURS * 60 * 60 * 1000;

/**
 * How far apart the arrival and departure airports may be for a stop to still
 * count as a layover, so that self-transfers such as Gatwick to Heathrow group.
 */
export const MAX_TRANSFER_KM = 100;

/** Bucket for flights that only have a placeholder date. */
const UNDATED_YEAR = 0;

/** A run of legs connected by a layover, drawn as one uninterrupted block. */
export type LayoverGroup<T> = {
  key: string;
  /** The last upcoming flight sits directly above this group. */
  startsPastSection: boolean;
  flights: T[];
};

export type FlightListYear<T> = {
  /** `UNDATED_YEAR` for flights without a date. */
  year: number;
  groups: LayoverGroup<T>[];
};

export type FlightListPage<T> = {
  /** Zero-based index of the first flight in the complete sorted list. */
  firstFlightIndex: number;
  flights: T[];
  years: FlightListYear<T>[];
};

type Sortable = Pick<FlightData, 'id' | 'dateStart' | 'raw'>;
type Keyed<T> = { flight: T; at: number; day: string };

/** The first day a flight's date covers, as `yyyy-MM-dd`. */
const calendarDay = ({ date, datePrecision }: Flight) => {
  const [year, month = '01', day = '01'] = date.split('-');
  if (datePrecision === 'year') return `${year}-01-01`;
  if (datePrecision === 'month') return `${year}-${month}-01`;
  return `${year}-${month}-${day}`;
};

/*
 * Sorts newest first on the best known departure time. Actual times are only
 * recorded once a flight has been flown, so upcoming ones have to be ordered on
 * their scheduled time rather than on the start of their day.
 *
 * Flights without any time are ordered among themselves on their calendar date
 * and then on the order they were added in, so flights logged with only a month
 * keep the sequence they were entered in. Their start of day falls at a
 * different instant in every timezone, which would otherwise order them on
 * where they departed from. They are then merged with the timed flights on the
 * local departure date, and on the start of their day within one date. Flights
 * without any usable date sink to the bottom, where their year bucket renders.
 */
export const sortByDepartureDesc = <T extends Sortable>(flights: T[]): T[] => {
  const timed: Keyed<T>[] = [];
  const untimed: Keyed<T>[] = [];
  const undated: T[] = [];

  for (const flight of flights) {
    const departure = resolveFlightTimeline(flight.raw).effectiveDeparture;
    if (departure) {
      timed.push({
        flight,
        at: departure.getTime(),
        day: isValid(departure) ? format(departure, 'yyyy-MM-dd') : '',
      });
    } else if (flight.dateStart) {
      untimed.push({
        flight,
        at: flight.dateStart.getTime(),
        day: calendarDay(flight.raw),
      });
    } else {
      undated.push(flight);
    }
  }

  const newerDay = (a: Keyed<T>, b: Keyed<T>) =>
    a.day === b.day ? 0 : a.day > b.day ? -1 : 1;
  timed.sort((a, b) => b.at - a.at || b.flight.id - a.flight.id);
  untimed.sort((a, b) => newerDay(a, b) || b.flight.id - a.flight.id);
  const isOlder = (a: Keyed<T>, b: Keyed<T>) =>
    (newerDay(a, b) || b.at - a.at) > 0;

  const sorted: T[] = [];
  let i = 0;
  let j = 0;
  while (i < timed.length || j < untimed.length) {
    const nextTimed = timed[i];
    const nextUntimed = untimed[j];
    if (nextTimed && (!nextUntimed || !isOlder(nextTimed, nextUntimed))) {
      sorted.push(nextTimed.flight);
      i++;
    } else if (nextUntimed) {
      sorted.push(nextUntimed.flight);
      j++;
    }
  }

  return [...sorted, ...undated.sort((a, b) => b.id - a.id)];
};

/**
 * True when `later` leaves from where `earlier` landed, or from an airport
 * close enough to transfer to by road or rail, soon enough to be a layover.
 * Both times must be known: a same-day pair without times is just as likely to
 * be two unrelated flights.
 */
const isLayover = (earlier: FlightData, later: FlightData) => {
  const { to } = earlier;
  const { from } = later;
  if (!to || !from) return false;
  if (
    to.id !== from.id &&
    distanceBetween([to.lon, to.lat], [from.lon, from.lat]) / 1000 >
      MAX_TRANSFER_KM
  ) {
    return false;
  }

  const { effectiveArrival } = resolveFlightTimeline(earlier.raw);
  const { effectiveDeparture } = resolveFlightTimeline(later.raw);
  if (!effectiveArrival || !effectiveDeparture) return false;

  const gap = effectiveDeparture.getTime() - effectiveArrival.getTime();
  return gap >= 0 && gap < MAX_LAYOVER_MS;
};

/** Id of the first flight that has already happened, if upcoming ones precede it. */
const findPastSectionStart = (flights: FlightData[], now: Date) => {
  let seenUpcoming = false;

  for (const flight of flights) {
    if (!isCompletedFlight(flight.raw, now)) {
      seenUpcoming = true;
    } else if (seenUpcoming) {
      return flight.id;
    }
  }

  return null;
};

const groupByLayover = <T extends FlightData>(
  flights: T[],
  pastSectionStart: number | null,
): LayoverGroup<T>[] => {
  const groups: LayoverGroup<T>[] = [];

  for (const flight of flights) {
    const startsPastSection = flight.id === pastSectionStart;
    const openGroup = groups.at(-1);
    // Newest first, so the flight already in the group is the later leg.
    const laterLeg = openGroup?.flights.at(-1);

    // The upcoming/past boundary always breaks the run, so that a group never
    // straddles the divider drawn between the two sections.
    if (
      openGroup &&
      laterLeg &&
      !startsPastSection &&
      isLayover(flight, laterLeg)
    ) {
      openGroup.flights.push(flight);
      continue;
    }

    groups.push({
      key: `layover-group-${flight.id}`,
      startsPastSection,
      flights: [flight],
    });
  }

  return groups;
};

/**
 * Render model for the flight list: years newest first, each split into layover
 * groups, with the upcoming/past boundary marked on the group that follows it.
 * `flights` must already be sorted newest first.
 */
export const buildFlightListYears = <T extends FlightData>(
  flights: T[],
  now: Date,
): FlightListYear<T>[] => {
  const byYear = new Map<number, T[]>();

  for (const flight of flights) {
    const year = flight.date?.getFullYear() ?? UNDATED_YEAR;
    const bucket = byYear.get(year);
    if (bucket) bucket.push(flight);
    else byYear.set(year, [flight]);
  }

  const years = [...byYear.entries()].sort(([a], [b]) => b - a);
  // Undated flights sink to the bottom, so the boundary has to be resolved on
  // the rendered order instead of the incoming one.
  const pastSectionStart = findPastSectionStart(
    years.flatMap(([, yearFlights]) => yearFlights),
    now,
  );

  return years.map(([year, yearFlights]) => ({
    year,
    groups: groupByLayover(yearFlights, pastSectionStart),
  }));
};

/** Packs complete layover groups into pages without losing divider metadata. */
export const paginateFlightListYears = <T>(
  years: FlightListYear<T>[],
  pageSize: number,
): FlightListPage<T>[] => {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new RangeError('pageSize must be a positive integer');
  }

  const pages: FlightListPage<T>[] = [];
  let currentPage: FlightListPage<T> | null = null;
  let flightsBeforePage = 0;

  const finishPage = () => {
    if (!currentPage) return;
    pages.push(currentPage);
    flightsBeforePage += currentPage.flights.length;
    currentPage = null;
  };

  for (const year of years) {
    for (const group of year.groups) {
      if (
        currentPage &&
        currentPage.flights.length > 0 &&
        currentPage.flights.length + group.flights.length > pageSize
      ) {
        finishPage();
      }

      currentPage ??= {
        firstFlightIndex: flightsBeforePage,
        flights: [],
        years: [],
      };

      let pageYear = currentPage.years.at(-1);
      if (!pageYear || pageYear.year !== year.year) {
        pageYear = { year: year.year, groups: [] };
        currentPage.years.push(pageYear);
      }

      pageYear.groups.push(group);
      currentPage.flights.push(...group.flights);
    }
  }

  finishPage();
  return pages;
};
