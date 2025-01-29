import type { Airport } from '$lib/utils/data/airports';

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

  return [
    [Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)],
  ];
};
