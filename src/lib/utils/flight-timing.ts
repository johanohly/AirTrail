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

export type TimingNoteTime = { label: string; date: Date };

export type TimingSummary = {
  headline: string | null;
  status: TimingStatus;
  evidence: TimingNoteTime[];
};

const minutesBetween = (a: Date, b: Date) =>
  Math.max(1, Math.round(Math.abs(a.getTime() - b.getTime()) / 60_000));

const formatOffset = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
};

const summarize = (
  status: TimingStatus,
  actual: Date,
  scheduled: Date,
): string =>
  status
    ? `${formatOffset(minutesBetween(actual, scheduled))} ${status}`
    : 'On time';

/* What the time tooltip says about a flight time. Taxi time is unknown, so a
 * runway time against a gate schedule can be known without a verdict. */
export const buildTimingSummary = ({
  gateActual,
  gateScheduled,
  runwayActual,
  runwayScheduled,
  side,
}: Parameters<typeof resolveTimingStatus>[0]): TimingSummary => {
  const status = resolveTimingStatus({
    gateActual,
    gateScheduled,
    runwayActual,
    runwayScheduled,
    side,
  });

  if (gateActual) {
    return gateScheduled
      ? {
          headline: summarize(status, gateActual, gateScheduled),
          status,
          evidence: [{ label: 'Scheduled', date: gateScheduled }],
        }
      : { headline: null, status, evidence: [] };
  }
  if (!runwayActual) return { headline: null, status, evidence: [] };

  const runwayEvidence = {
    label: side === 'departure' ? 'Took off' : 'Landed',
    date: runwayActual,
  };
  if (runwayScheduled) {
    return {
      headline: summarize(status, runwayActual, runwayScheduled),
      status,
      evidence: [runwayEvidence, { label: 'scheduled', date: runwayScheduled }],
    };
  }
  if (!gateScheduled) {
    return { headline: null, status, evidence: [] };
  }
  return status
    ? {
        headline: summarize(status, runwayActual, gateScheduled),
        status,
        evidence: [runwayEvidence, { label: 'scheduled', date: gateScheduled }],
      }
    : { headline: null, status, evidence: [runwayEvidence] };
};
