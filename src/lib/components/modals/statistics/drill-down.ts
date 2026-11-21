import { FLIGHT_CHARTS, type FlightChartKey } from '$lib/stats/aggregations';
import {
  isPunctualityGroupKey,
  type PunctualityGroupKey,
} from '$lib/stats/punctuality';

/** The sheet open over the statistics. Only one is open at a time. */
export type DrillDown =
  | { kind: 'chart'; chart: FlightChartKey; entry: string | null }
  | { kind: 'continent'; continent: string }
  | { kind: 'punctuality'; group: PunctualityGroupKey; entry: string | null }
  | { kind: 'delayed-flights' };

const entryOf = (value: unknown) => (typeof value === 'string' ? value : null);

/* History entries outlive the code that wrote them, so a state from another
 * version (or another tab's modal) is checked rather than trusted. */
export const parseDrillDown = (state: unknown): DrillDown | null => {
  if (typeof state !== 'object' || state === null) return null;
  const value = state as Record<string, unknown>;

  switch (value.kind) {
    case 'chart':
      return typeof value.chart === 'string' &&
        Object.hasOwn(FLIGHT_CHARTS, value.chart)
        ? {
            kind: 'chart',
            chart: value.chart as FlightChartKey,
            entry: entryOf(value.entry),
          }
        : null;
    case 'continent':
      return typeof value.continent === 'string'
        ? { kind: 'continent', continent: value.continent }
        : null;
    case 'punctuality':
      return isPunctualityGroupKey(value.group)
        ? {
            kind: 'punctuality',
            group: value.group,
            entry: entryOf(value.entry),
          }
        : null;
    case 'delayed-flights':
      return { kind: 'delayed-flights' };
    default:
      return null;
  }
};
