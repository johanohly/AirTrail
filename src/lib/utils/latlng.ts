export const calculateBounds = (
  data: ({ from: { position: number[] }; to: { position: number[] } } | null)[],
): [[number, number], [number, number]] | undefined => {
  if (!data.length) {
    return undefined;
  }

  const latitudes = data.map((d) => d.from.position[0]).concat(data.map((d) => d.to.position[0]));
  const longitudes = data
    .map((d) => d.from.position[1])
    .concat(data.map((d) => d.to.position[1]));

  return [
    [Math.min(...latitudes), Math.min(...longitudes)],
    [Math.max(...latitudes), Math.max(...longitudes)],
  ];
};
