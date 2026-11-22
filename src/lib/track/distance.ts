import type { FlightTrackPayload } from './schema';

import { distanceBetween } from '$lib/utils/distance';

/*
 * The length of a flight track, in km, for the flight's distance.
 *
 * GPS jamming and spoofing show up in recorded tracks as positions that jump
 * kilometres away and back within seconds (seen over the Black Sea and the
 * Caspian in FR24 exports). Summing those as-is inflates the distance, so when
 * the track has timestamps, any point the aircraft could not have reached from
 * the last accepted point at `MAX_GROUND_SPEED_KMH` is skipped. Tracks without
 * timestamps are summed as they are; `resolveFlightDistance` still rejects a
 * total that is implausible for the route.
 */

/**
 * Well above the fastest airliner ground speed in real tracks (about 1,330
 * km/h in a strong jet stream), and well below what a spoofed jump implies.
 */
export const MAX_GROUND_SPEED_KMH = 1_500;
/** Jumps shorter than this are GPS noise that barely changes the total. */
const MIN_JUMP_KM = 1;

type MeasurableTrack = Pick<FlightTrackPayload, 'coordinates' | 'times'>;

export const measureTrackDistance = (track: MeasurableTrack): number => {
  const { coordinates, times } = track;
  const timed = times?.length === coordinates.length;
  const lonLat = (index: number) => {
    const [lon, lat] = coordinates[index]!;
    return [lon, lat] as [number, number];
  };
  let total = 0;
  let last = 0;

  for (let i = 1; i < coordinates.length; i++) {
    const km = distanceBetween(lonLat(last), lonLat(i)) / 1000;
    if (timed && km > MIN_JUMP_KM) {
      const hours = (times[i]! - times[last]!) / 3600;
      if (hours <= 0 || km / hours > MAX_GROUND_SPEED_KMH) continue;
    }
    total += km;
    last = i;
  }

  return total;
};
