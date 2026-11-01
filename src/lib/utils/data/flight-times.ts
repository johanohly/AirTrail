import type { FlightData } from './data';

import type { Airport } from '$lib/db/types';
import { parseLocalizeISO } from '$lib/utils/datetime';
import {
  buildTimingSummary,
  type TimingStatus,
  type TimingSummary,
} from '$lib/utils/flight-timing';

export type FlightSideTimes = {
  /** Instant to display; honours the flightTimeSource preference. */
  at: Date | null;
  /** True when `at` is the recorded actual time (reference equality — do not clone dates). */
  isActual: boolean;
  /** Recorded gate actual. */
  actual: Date | null;
  /** Scheduled gate time. */
  scheduled: Date | null;
  /** Delay summary powering the tooltip headline and the status coloring. */
  timing: TimingSummary;
};

const parseRunwayTime = (value: string | null, airport: Airport | null) =>
  value && airport ? parseLocalizeISO(value, airport.tz) : null;

export const buildFlightSideTimes = (
  flight: FlightData,
  side: 'departure' | 'arrival',
  preferScheduled = false,
): FlightSideTimes => {
  const airport = side === 'departure' ? flight.from : flight.to;
  const actual = side === 'departure' ? flight.departure : flight.arrival;
  const rawScheduled =
    side === 'departure'
      ? flight.raw.departureScheduled
      : flight.raw.arrivalScheduled;
  const scheduled =
    rawScheduled && airport ? parseLocalizeISO(rawScheduled, airport.tz) : null;
  const runwayActual = parseRunwayTime(
    side === 'departure' ? flight.raw.takeoffActual : flight.raw.landingActual,
    airport,
  );
  const runwayScheduled = parseRunwayTime(
    side === 'departure'
      ? flight.raw.takeoffScheduled
      : flight.raw.landingScheduled,
    airport,
  );
  const timing = buildTimingSummary({
    gateActual: actual,
    gateScheduled: scheduled,
    runwayActual,
    runwayScheduled,
    side,
  });
  const at = preferScheduled ? (scheduled ?? actual) : (actual ?? scheduled);
  return {
    at,
    isActual: at !== null && at === actual,
    actual,
    scheduled,
    timing,
  };
};

export const timingStatusClass = (status: TimingStatus) => ({
  'text-green-600 dark:text-green-400': status === 'early',
  'text-red-600 dark:text-red-400': status === 'late',
});
