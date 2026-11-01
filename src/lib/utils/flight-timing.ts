export type TimingStatus = 'early' | 'late' | null;

export const compareTiming = (actual: Date, scheduled: Date): TimingStatus => {
  if (actual < scheduled) return 'early';
  if (actual > scheduled) return 'late';
  return null;
};

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
  if (gateActual) {
    return gateScheduled ? compareTiming(gateActual, gateScheduled) : null;
  }
  if (!runwayActual) return null;
  if (runwayScheduled) return compareTiming(runwayActual, runwayScheduled);
  if (!gateScheduled) return null;

  // Taxi time is unknown, so only infer the direction that is certain.
  const status = compareTiming(runwayActual, gateScheduled);
  if (side === 'departure' && status === 'early') return 'early';
  if (side === 'arrival' && status === 'late') return 'late';
  return null;
};
