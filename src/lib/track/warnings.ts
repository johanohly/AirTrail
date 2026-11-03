import type { TrackValidationIssue } from './validation';

export type TrackWarning = {
  kind: 'timing' | 'metadata';
  message: string;
  details: { label: string; trackValue: string; enteredValue: string }[];
};

const joinLabels = (labels: string[]) =>
  labels.length < 3
    ? labels.join(' and ')
    : `${labels.slice(0, -1).join(', ')}, and ${labels.at(-1)}`;

export const formatTrackWarnings = (
  issues: TrackValidationIssue[],
): TrackWarning[] => {
  const warnings: TrackWarning[] = [];
  const timing = issues.filter((issue) => issue.kind === 'timing');
  if (timing.length) {
    const labels = joinLabels(timing.map((issue) => issue.field));
    const subject = labels[0]!.toUpperCase() + labels.slice(1);
    const reference = timing.every((issue) => issue.comparison === 'scheduled')
      ? 'the original schedule'
      : timing.every((issue) => issue.comparison === 'actual')
        ? `the entered actual ${timing.length === 1 ? 'time' : 'times'}`
        : 'the entered flight times';
    warnings.push({
      kind: 'timing',
      message: `${subject} track ${timing.length === 1 ? 'time differs' : 'times differ'} from ${reference} by more than 24 hours. Check that this track belongs to this flight.`,
      details: [],
    });
  }
  const metadata = issues.filter((issue) => issue.kind === 'metadata');
  if (metadata.length) {
    const labels = {
      departure: 'departure airport',
      arrival: 'arrival airport',
      flightNumber: 'flight number/callsign',
    };
    warnings.push({
      kind: 'metadata',
      message: `Track details don't match this flight: ${joinLabels(metadata.map((issue) => labels[issue.field]))}.`,
      details: metadata.map((issue) => ({
        label:
          labels[issue.field][0]!.toUpperCase() + labels[issue.field].slice(1),
        trackValue: issue.trackValue,
        enteredValue: issue.enteredValue,
      })),
    });
  }
  return warnings;
};
