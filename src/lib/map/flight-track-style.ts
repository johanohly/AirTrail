import type { Color } from '@deck.gl/core';

import type { FlightTrackPath } from './flight-layer-data';

import type { FlightTrackCoordinate } from '$lib/track/schema';

export type FlightTrackRun = Omit<
  FlightTrackPath,
  'path' | 'ground' | 'estimated'
> & {
  path: FlightTrackCoordinate[];
  altitudeFeet: number | null;
  ground: boolean;
  estimated: boolean;
};

type RgbStop = { at: number; color: readonly [number, number, number] };

const METERS_TO_FEET = 3.280839895013123;

const AIRTRAIL_COLOR_STOPS: RgbStop[] = [
  { at: 0, color: [249, 115, 22] },
  { at: 2_000, color: [245, 158, 11] },
  { at: 4_000, color: [234, 179, 8] },
  { at: 6_000, color: [132, 204, 22] },
  { at: 8_000, color: [34, 197, 94] },
  { at: 9_000, color: [16, 185, 129] },
  { at: 11_000, color: [6, 182, 212] },
  { at: 40_000, color: [139, 92, 246] },
  { at: 51_000, color: [239, 68, 68] },
];

const toLinear = (value: number) => {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
};

const toSrgb = (value: number) => {
  const normalized =
    value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(1, normalized)) * 255);
};

const rgbToOklab = (color: readonly [number, number, number]) => {
  const red = toLinear(color[0]);
  const green = toLinear(color[1]);
  const blue = toLinear(color[2]);
  const l = Math.cbrt(
    0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue,
  );
  const m = Math.cbrt(
    0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue,
  );
  const s = Math.cbrt(
    0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue,
  );
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ] as const;
};

const oklabToRgb = (color: readonly [number, number, number]): Color => {
  const l = (color[0] + 0.3963377774 * color[1] + 0.2158037573 * color[2]) ** 3;
  const m = (color[0] - 0.1055613458 * color[1] - 0.0638541728 * color[2]) ** 3;
  const s = (color[0] - 0.0894841775 * color[1] - 1.291485548 * color[2]) ** 3;
  return [
    toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
};

const interpolateAirTrailColor = (altitudeFeet: number): Color => {
  if (altitudeFeet <= AIRTRAIL_COLOR_STOPS[0]!.at) {
    return [...AIRTRAIL_COLOR_STOPS[0]!.color];
  }
  const last = AIRTRAIL_COLOR_STOPS.at(-1)!;
  if (altitudeFeet >= last.at) return [...last.color];

  for (let index = 1; index < AIRTRAIL_COLOR_STOPS.length; index++) {
    const upper = AIRTRAIL_COLOR_STOPS[index]!;
    if (altitudeFeet > upper.at) continue;
    const lower = AIRTRAIL_COLOR_STOPS[index - 1]!;
    const progress = (altitudeFeet - lower.at) / (upper.at - lower.at);
    const from = rgbToOklab(lower.color);
    const to = rgbToOklab(upper.color);
    return oklabToRgb([
      from[0] + (to[0] - from[0]) * progress,
      from[1] + (to[1] - from[1]) * progress,
      from[2] + (to[2] - from[2]) * progress,
    ]);
  }

  return [...last.color];
};

const darkenEstimated = (color: Color): Color =>
  color.map((component, index) =>
    index < 3 ? Math.round(component * 0.8) : component,
  ) as Color;

export const metersToFeet = (meters: number) => meters * METERS_TO_FEET;

export const roundFlightTrackAltitude = (altitudeFeet: number) => {
  const interval = altitudeFeet < 8_000 ? 50 : 500;
  return interval * Math.round(altitudeFeet / interval);
};

export const getFlightTrackColor = ({
  altitudeFeet,
  ground,
  estimated = false,
}: {
  altitudeFeet: number | null;
  ground: boolean;
  estimated?: boolean;
}): Color => {
  const color: Color = ground
    ? [82, 82, 91]
    : altitudeFeet === null
      ? [161, 161, 170]
      : interpolateAirTrailColor(altitudeFeet);

  return estimated ? darkenEstimated(color) : color;
};

const getPointStyle = (track: FlightTrackPath, index: number) => {
  const coordinate = track.path[index]!;
  const ground = track.ground?.[index] ?? false;
  const altitudeFeet =
    ground || coordinate[2] === undefined
      ? null
      : roundFlightTrackAltitude(metersToFeet(coordinate[2]));
  return {
    altitudeFeet,
    ground,
    estimated: track.estimated?.[index] ?? false,
  };
};

const stylesMatch = (
  left: ReturnType<typeof getPointStyle>,
  right: ReturnType<typeof getPointStyle>,
) =>
  left.altitudeFeet === right.altitudeFeet &&
  left.ground === right.ground &&
  left.estimated === right.estimated;

export const buildFlightTrackRuns = (tracks: FlightTrackPath[]) => {
  const runs: FlightTrackRun[] = [];

  for (const track of tracks) {
    if (track.path.length < 2) continue;

    let style = getPointStyle(track, 0);
    let path: FlightTrackCoordinate[] = [track.path[0]!];

    for (let index = 0; index < track.path.length - 1; index++) {
      const edgeStyle = getPointStyle(track, index);
      if (!stylesMatch(style, edgeStyle)) {
        if (path.length >= 2) runs.push({ ...track, ...style, path });
        style = edgeStyle;
        path = [track.path[index]!];
      }
      path.push(track.path[index + 1]!);
    }

    if (path.length >= 2) runs.push({ ...track, ...style, path });
  }

  return runs;
};
