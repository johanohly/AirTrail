import { describe, expect, it } from 'vitest';

import type { TrackValidationIssue } from './validation';
import { formatTrackWarnings } from './warnings';

const departure: TrackValidationIssue = {
  kind: 'timing',
  field: 'departure',
  comparison: 'scheduled',
  message: '',
};
const arrival: TrackValidationIssue = {
  kind: 'timing',
  field: 'arrival',
  comparison: 'scheduled',
  message: '',
};
const metadata: TrackValidationIssue[] = [
  {
    kind: 'metadata',
    field: 'departure',
    message: '',
    trackValue: 'MAN / EGCC',
    enteredValue: 'LHR',
  },
  {
    kind: 'metadata',
    field: 'arrival',
    message: '',
    trackValue: 'HKG / VHHH',
    enteredValue: 'SIN',
  },
  {
    kind: 'metadata',
    field: 'flightNumber',
    message: '',
    trackValue: 'CX216 / CPA216',
    enteredValue: 'CX219',
  },
];

describe('grouped track warnings', () => {
  it('renders nothing when all checks match', () => {
    expect(formatTrackWarnings([])).toEqual([]);
  });

  it('names a single mismatched time', () => {
    expect(formatTrackWarnings([departure])).toEqual([
      {
        kind: 'timing',
        message:
          'Departure track time differs from the original schedule by more than 24 hours. Check that this track belongs to this flight.',
        details: [],
      },
    ]);
  });

  it('describes actual and mixed time references accurately', () => {
    const actual: TrackValidationIssue = {
      ...arrival,
      kind: 'timing',
      comparison: 'actual',
    };
    expect(formatTrackWarnings([actual])[0]?.message).toContain(
      'entered actual time',
    );
    expect(formatTrackWarnings([departure, actual])[0]?.message).toContain(
      'entered flight times',
    );
  });

  it('shows only mismatched fields with track and entered values in the correct direction', () => {
    expect(formatTrackWarnings([metadata[0]!, metadata[2]!])).toEqual([
      {
        kind: 'metadata',
        message:
          "Track details don't match this flight: departure airport and flight number/callsign.",
        details: [
          {
            label: 'Departure airport',
            trackValue: 'MAN / EGCC',
            enteredValue: 'LHR',
          },
          {
            label: 'Flight number/callsign',
            trackValue: 'CX216 / CPA216',
            enteredValue: 'CX219',
          },
        ],
      },
    ]);
  });

  it('uses natural list punctuation and keeps timing above flight details', () => {
    const warnings = formatTrackWarnings([...metadata, departure, arrival]);
    expect(warnings.map((warning) => warning.kind)).toEqual([
      'timing',
      'metadata',
    ]);
    expect(warnings[0]?.message).toContain(
      'Departure and arrival track times differ from the original schedule by more than 24 hours',
    );
    expect(warnings[0]?.details).toEqual([]);
    expect(warnings[1]?.details.map((detail) => detail.label)).toEqual([
      'Departure airport',
      'Arrival airport',
      'Flight number/callsign',
    ]);
    expect(warnings[1]?.message).toBe(
      "Track details don't match this flight: departure airport, arrival airport, and flight number/callsign.",
    );
  });
});
