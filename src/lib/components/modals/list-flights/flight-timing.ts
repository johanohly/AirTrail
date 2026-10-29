export type TimingStatus = 'early' | 'late' | null;

/** Gate times take precedence; runway times are only used when the gate actual is missing. */
export const resolveTimingStatus = ({
  gateActual,
  gateScheduled,
  runwayActual,
  runwayScheduled,
  side,
}: {
  gateActual: Date | null;
  gateScheduled: Date | null;
  runwayActual: Date | null;
  runwayScheduled: Date | null;
  side: 'departure' | 'arrival';
}): TimingStatus => {
  const compare = (actual: Date, scheduled: Date): TimingStatus => {
    if (actual < scheduled) return 'early';
    if (actual > scheduled) return 'late';
    return null;
  };

  if (gateActual) {
    return gateScheduled ? compare(gateActual, gateScheduled) : null;
  }
  if (!runwayActual) return null;
  if (runwayScheduled) return compare(runwayActual, runwayScheduled);
  if (!gateScheduled) return null;

  // Taxi time is unknown, so only infer the direction that is certain.
  const status = compare(runwayActual, gateScheduled);
  if (side === 'departure' && status === 'early') return 'early';
  if (side === 'arrival' && status === 'late') return 'late';
  return null;
};
