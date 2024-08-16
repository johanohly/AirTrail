export const calculateBounds = (
  data: ({ from: number[]; to: number[] } | null)[],
): [[number, number], [number, number]] | undefined => {
  if (!data.length) {
    return undefined;
  }

  const latitudes = data.map((d) => d.from[0]).concat(data.map((d) => d.to[0]));
  const longitudes = data
    .map((d) => d.from[1])
    .concat(data.map((d) => d.to[1]));

  return [
    [Math.min(...latitudes), Math.min(...longitudes) - 7],
    [Math.max(...latitudes), Math.max(...longitudes) + 7],
  ];
};
