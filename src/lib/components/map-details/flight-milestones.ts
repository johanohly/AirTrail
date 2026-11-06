import { codeForAirport, routeLabelForFlight } from '$lib/stats/aggregations';
import { passengerForUser, toTitleCase, type FlightData } from '$lib/utils';

export type FlightMilestone = { key: string; text: string };

/*
 * Milestones are the firsts and round numbers a flight reaches among one
 * traveller's flights. Counts in between ("57th time at CPH") are left out on
 * purpose: on a real account they show up on every flight and stop meaning
 * anything.
 */

const isRound = (n: number) =>
  n === 10 || n === 25 || n === 50 || (n >= 100 && n % 100 === 0);

const ORDINAL_SUFFIXES: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' };

const ordinal = (n: number) => {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  return `${n}${ORDINAL_SUFFIXES[n % 10] ?? 'th'}`;
};

const cabinLabel = (seatClass: string) =>
  seatClass === 'first' ? 'First class' : toTitleCase(seatClass);

/**
 * `chronological` is the traveller's flights, oldest first, in the same order
 * the flight list shows them.
 */
export const buildFlightMilestones = (
  chronological: FlightData[],
  flight: FlightData,
  userId: string,
): FlightMilestone[] => {
  const index = chronological.findIndex((f) => f.id === flight.id);
  if (index === -1) return [];
  if (index === 0) return [{ key: 'overall', text: 'First flight' }];

  const earlier = chronological.slice(0, index);
  const milestones: FlightMilestone[] = [];
  const nth = (
    key: string,
    matches: (f: FlightData) => boolean,
    firstText: string | null,
    nthText: string,
  ) => {
    const n = earlier.filter(matches).length + 1;
    if (n === 1 && firstText) milestones.push({ key, text: firstText });
    else if (isRound(n))
      milestones.push({ key, text: `${ordinal(n)} ${nthText}` });
  };

  if (isRound(index + 1)) {
    milestones.push({ key: 'overall', text: `${ordinal(index + 1)} flight` });
  }

  const { from, to } = flight;
  const newDestination =
    !!to && !earlier.some((f) => f.from?.id === to.id || f.to?.id === to.id);
  if (to && newDestination) {
    milestones.push({
      key: 'airport',
      text: `First time at ${codeForAirport(to)}`,
    });
  }

  const route = routeLabelForFlight(flight);
  if (from && to && route) {
    const between = `between ${codeForAirport(from)} and ${codeForAirport(to)}`;
    // A new destination already implies a new route.
    nth(
      'route',
      (f) => routeLabelForFlight(f) === route,
      newDestination ? null : `First flight ${between}`,
      `flight ${between}`,
    );
  }

  const { airline, aircraft } = flight;
  if (airline) {
    nth(
      'airline',
      (f) => f.airline?.id === airline.id,
      `First flight with ${airline.name}`,
      `flight with ${airline.name}`,
    );
  }
  if (aircraft) {
    nth(
      'aircraft',
      (f) => f.aircraft?.id === aircraft.id,
      `First flight on ${aircraft.name}`,
      `flight on ${aircraft.name}`,
    );
  }

  // Every registration is new the first time, so only a repeat is notable.
  const reg = flight.aircraftReg?.trim();
  const sameReg = reg
    ? earlier.filter((f) => f.aircraftReg?.trim() === reg).length
    : 0;
  if (reg && sameReg > 0) {
    milestones.push({
      key: 'reg',
      text: `${ordinal(sameReg + 1)} flight on ${reg}`,
    });
  }

  const seatClass = passengerForUser(flight, userId)?.seatClass;
  if (
    seatClass &&
    !earlier.some((f) => passengerForUser(f, userId)?.seatClass === seatClass)
  ) {
    milestones.push({
      key: 'cabin',
      text: `First time in ${cabinLabel(seatClass)}`,
    });
  }

  return milestones;
};
