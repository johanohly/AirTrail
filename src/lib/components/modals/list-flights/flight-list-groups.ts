import type { FlightData } from '$lib/utils';
import {
  isCompletedFlight,
  resolveFlightTimeline,
} from '$lib/utils/data/flight-timeline';

/** Ground time under which two legs still read as one trip rather than two. */
export const MAX_LAYOVER_HOURS = 12;

const MAX_LAYOVER_MS = MAX_LAYOVER_HOURS * 60 * 60 * 1000;

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

/**
 * Sorts newest first on the best known departure time. Actual times are only
 * recorded once a flight has been flown, so upcoming ones have to be ordered on
 * their scheduled time rather than on the start of their day. Flights without
 * any usable date sink to the bottom, where their year bucket renders.
 */
export const sortByDepartureDesc = <T extends FlightData>(flights: T[]): T[] =>
  flights
    .map((flight) => ({
      flight,
      at:
        (
          resolveFlightTimeline(flight.raw).effectiveDeparture ??
          flight.dateStart
        )?.getTime() ?? null,
    }))
    .sort((a, b) => {
      if (a.at === null || b.at === null) {
        return (a.at === null ? 1 : 0) - (b.at === null ? 1 : 0);
      }
      return b.at - a.at;
    })
    .map(({ flight }) => flight);

/**
 * True when `later` leaves from where `earlier` landed, soon enough to be a
 * layover. Both times must be known: a same-day pair without times is just as
 * likely to be two unrelated flights.
 */
const isLayover = (earlier: FlightData, later: FlightData) => {
  if (!earlier.to || !later.from || earlier.to.id !== later.from.id) {
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
