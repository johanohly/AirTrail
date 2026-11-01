import { METRO_AREAS, type MetroAreaCode } from '$lib/data/metro-areas';

// Resolved once at module load: every known ICAO points at its cluster.
const icaoToMetroArea = new Map<string, MetroAreaCode>(
  Object.entries(METRO_AREAS).flatMap(([code, { icaos }]) =>
    icaos.map((icao) => [icao, code as MetroAreaCode]),
  ),
);

/**
 * Cluster an airport belongs to, or `null` when it is unknown. Accepts any
 * casing so hand-entered custom ICAOs still match; no IATA fallback, since
 * `iata` is nullable and the gain would be negligible.
 */
export const metroAreaForIcao = (
  icao: string | null | undefined,
): MetroAreaCode | null =>
  icao ? (icaoToMetroArea.get(icao.toUpperCase()) ?? null) : null;

/** True when both airports resolve to the same metro area. */
export const sameMetroArea = (
  a: string | null | undefined,
  b: string | null | undefined,
): boolean => {
  const area = metroAreaForIcao(a);
  return area !== null && area === metroAreaForIcao(b);
};
