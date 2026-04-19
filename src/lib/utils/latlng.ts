import type { Airport } from '$lib/utils/data/airports';

const toWrappedLongitude = (longitude: number) => {
  return ((longitude % 360) + 360) % 360;
};

export const calculateBounds = (
  data: { from: Airport; to: Airport }[],
): [[number, number], [number, number]] | undefined => {
  if (!data.length) {
    return undefined;
  }

  const latitudes = data
    .map((d) => d.from.lat)
    .concat(data.map((d) => d.to.lat));
  const longitudes = data
    .map((d) => d.from.lon)
    .concat(data.map((d) => d.to.lon));

  const directWest = Math.min(...longitudes);
  const directEast = Math.max(...longitudes);

  const wrappedLongitudes = longitudes
    .map(toWrappedLongitude)
    .sort((a, b) => a - b);
  const wrappedCycle = [...wrappedLongitudes, wrappedLongitudes[0]! + 360];

  let largestGapIndex = 0;
  let largestGap = -Infinity;

  for (let index = 0; index < wrappedLongitudes.length; index++) {
    const gap = wrappedCycle[index + 1]! - wrappedCycle[index]!;
    if (gap > largestGap) {
      largestGap = gap;
      largestGapIndex = index;
    }
  }

  const wrappedWest = wrappedCycle[largestGapIndex + 1]! % 360;
  let wrappedEast = wrappedCycle[largestGapIndex]!;
  if (wrappedEast < wrappedWest) {
    wrappedEast += 360;
  }

  const directSpan = directEast - directWest;
  const wrappedSpan = wrappedEast - wrappedWest;
  const west = wrappedSpan < directSpan ? wrappedWest : directWest;
  const east = wrappedSpan < directSpan ? wrappedEast : directEast;

  return [
    [west, Math.min(...latitudes)],
    [east, Math.max(...latitudes)],
  ];
};
