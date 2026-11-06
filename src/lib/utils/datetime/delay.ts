import { Duration } from './duration';

export type DelayStatus = 'early' | 'late' | 'on-time';

export interface DelayInfo {
  status: DelayStatus;
  /** actual − scheduled in seconds; negative when early. */
  seconds: number;
  label: string;
}

/**
 * Describes how far an actual instant deviates from the scheduled one.
 * Compares absolute instants only — no timezone math, so the sign is always
 * actual − scheduled regardless of which of the two is being displayed.
 *
 * `toleranceSeconds` collapses sub-tolerance deviations into "on time"; the
 * flight list passes 0 to keep its coloring identical to the raw comparison,
 * while the tooltip passes 60 so a few seconds of jitter doesn't render as
 * "0m late".
 */
export const describeDelay = (
  actual: Date,
  scheduled: Date,
  toleranceSeconds = 0,
): DelayInfo => {
  const seconds = Math.round((actual.getTime() - scheduled.getTime()) / 1000);
  if (Math.abs(seconds) <= toleranceSeconds) {
    return { status: 'on-time', seconds, label: 'on time' };
  }
  if (seconds > 0) {
    return {
      status: 'late',
      seconds,
      label: `${Duration.fromSeconds(seconds).toString()} late`,
    };
  }
  return {
    status: 'early',
    seconds,
    label: `${Duration.fromSeconds(-seconds).toString()} early`,
  };
};
