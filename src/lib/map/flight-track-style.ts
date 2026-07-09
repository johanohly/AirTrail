import type { Color } from '@deck.gl/core';

import type { FlightTrackPath } from './flight-layer-data';

import type { FlightTrackCoordinate } from '$lib/track/schema';

export type FlightTrackPalette = 'tar1090' | 'airtrail';

export type FlightTrackRun = Omit<
  FlightTrackPath,
  'path' | 'ground' | 'estimated'
> & {
  path: FlightTrackCoordinate[];
  altitudeFeet: number | null;
  ground: boolean;
  estimated: boolean;
};

type NumericStop = { at: number; value: number };
type RgbStop = { at: number; color: readonly [number, number, number] };

const METERS_TO_FEET = 3.280839895013123;

const TAR1090_HUE_STOPS: NumericStop[] = [
  { at: 0, value: 20 },
  { at: 2_000, value: 32.5 },
  { at: 4_000, value: 43 },
  { at: 6_000, value: 54 },
  { at: 8_000, value: 72 },
  { at: 9_000, value: 85 },
  { at: 11_000, value: 140 },
  { at: 40_000, value: 300 },
  { at: 51_000, value: 360 },
];

const TAR1090_LIGHTNESS_STOPS: NumericStop[] = [
  { at: 0, value: 53 },
  { at: 20, value: 50 },
  { at: 32, value: 54 },
  { at: 40, value: 52 },
  { at: 46, value: 51 },
  { at: 50, value: 46 },
  { at: 60, value: 43 },
  { at: 80, value: 41 },
  { at: 100, value: 41 },
  { at: 120, value: 41 },
  { at: 140, value: 41 },
  { at: 160, value: 40 },
  { at: 180, value: 40 },
  { at: 190, value: 44 },
  { at: 198, value: 50 },
  { at: 200, value: 58 },
  { at: 220, value: 58 },
  { at: 240, value: 58 },
  { at: 255, value: 55 },
  { at: 266, value: 55 },
  { at: 270, value: 58 },
  { at: 280, value: 58 },
  { at: 290, value: 47 },
  { at: 300, value: 43 },
  { at: 310, value: 48 },
  { at: 320, value: 48 },
  { at: 340, value: 52 },
  { at: 360, value: 53 },
];

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

const interpolateStops = (stops: NumericStop[], input: number) => {
  if (input <= stops[0]!.at) return stops[0]!.value;
  const last = stops.at(-1)!;
  if (input >= last.at) return last.value;

  for (let index = 1; index < stops.length; index++) {
    const upper = stops[index]!;
    if (input > upper.at) continue;
    const lower = stops[index - 1]!;
    const progress = (input - lower.at) / (upper.at - lower.at);
    return lower.value + (upper.value - lower.value) * progress;
  }

  return last.value;
};

const hslToRgb = (
  hue: number,
  saturation: number,
  lightness: number,
): Color => {
  const h = ((hue % 360) + 360) % 360;
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const section = h / 60;
  const x = chroma * (1 - Math.abs((section % 2) - 1));
  let rgb: [number, number, number];

  if (section < 1) rgb = [chroma, x, 0];
  else if (section < 2) rgb = [x, chroma, 0];
  else if (section < 3) rgb = [0, chroma, x];
  else if (section < 4) rgb = [0, x, chroma];
  else if (section < 5) rgb = [x, 0, chroma];
  else rgb = [chroma, 0, x];

  const match = l - chroma / 2;
  return rgb.map((component) => Math.round((component + match) * 255)) as Color;
};

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
  palette,
}: {
  altitudeFeet: number | null;
  ground: boolean;
  estimated?: boolean;
  palette: FlightTrackPalette;
}): Color => {
  let color: Color;

  if (palette === 'airtrail') {
    color = ground
      ? [82, 82, 91]
      : altitudeFeet === null
        ? [161, 161, 170]
        : interpolateAirTrailColor(altitudeFeet);
  } else {
    const hue = ground
      ? 220
      : altitudeFeet === null
        ? 0
        : interpolateStops(TAR1090_HUE_STOPS, altitudeFeet);
    const saturation = ground || altitudeFeet === null ? 0 : 88;
    const lightness = ground
      ? 30
      : altitudeFeet === null
        ? 75
        : interpolateStops(TAR1090_LIGHTNESS_STOPS, hue);
    color = hslToRgb(hue, saturation, lightness);
  }

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
