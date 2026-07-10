import { describe, expect, it } from 'vitest';

import {
  flightTrackPayloadSchema,
  toFlightTrackInput,
  toFlightTrackPayload,
} from './schema';

const track = {
  coordinates: [
    [10, 55, 0],
    [11, 56, 304.8],
  ] as [number, number, number][],
  times: [1_700_000_000, 1_700_000_060],
  groundSpeedKt: [0, 120],
  trackDeg: [90, 95],
  ground: [true, false],
  estimated: [false, true],
};

describe('flight track schema helpers', () => {
  it('rejects point flags that are not aligned with coordinates', () => {
    expect(
      flightTrackPayloadSchema.safeParse({ ...track, ground: [true] }).success,
    ).toBe(false);
    expect(
      flightTrackPayloadSchema.safeParse({ ...track, estimated: [false] })
        .success,
    ).toBe(false);
  });

  it('copies every aligned property into database payloads', () => {
    expect(toFlightTrackPayload(track)).toEqual(track);
  });

  it('can omit shared timestamps without dropping point flags', () => {
    expect(
      toFlightTrackInput(
        {
          ...track,
          sourceFormat: 'kml',
          sourceName: 'flight.kml',
        },
        { includeTimes: false },
      ),
    ).toEqual({
      coordinates: track.coordinates,
      groundSpeedKt: track.groundSpeedKt,
      trackDeg: track.trackDeg,
      ground: track.ground,
      estimated: track.estimated,
      sourceFormat: 'kml',
      sourceName: 'flight.kml',
    });
  });
});
