import maplibregl, { type LngLatLike } from "maplibre-gl";

const { LngLat } = maplibregl;

export const distanceBetween = (a: LngLatLike, b: LngLatLike): number => {
  const from = LngLat.convert(a);
  const to = LngLat.convert(b);
  return from.distanceTo(to);
};

export const linearClamped = (distance: number, minDistance = 0, maxDistance = 15000, min = 1, max = 4): number => {
  // Ensure distance is within the bounds
  if (distance < minDistance) {
    distance = minDistance;
  } else if (distance > maxDistance) {
    distance = maxDistance;
  }

  // Linear mapping to the range [min, max]
  const value = min + ((distance - minDistance) / (maxDistance - minDistance)) * (max - min);
  return value;
};