import { formatCompactFlightDate } from '$lib/utils/preferences';
import type { FlightData } from './data';
import {
  getFlightTimelineWindow,
  resolveFlightTimeline,
} from './flight-timeline';

type Visit = { label: string; time: number };

export const getAirportVisitSummary = (
  flights: FlightData[],
  airportId: number,
  now: Date,
) => {
  let last: Visit | null = null;
  let next: Visit | null = null;

  for (const flight of flights) {
    const timeline = resolveFlightTimeline(flight.raw);
    const windows = [
      flight.from?.id === airportId
        ? getFlightTimelineWindow(timeline, 'departure')
        : null,
      flight.to?.id === airportId
        ? getFlightTimelineWindow(timeline, 'arrival')
        : null,
    ];

    for (const window of windows) {
      if (!window) continue;
      const label = formatCompactFlightDate(window.start, window.precision);

      if (window.end < now && (!last || window.end.getTime() > last.time)) {
        last = { label, time: window.end.getTime() };
      } else if (
        window.start > now &&
        (!next || window.start.getTime() < next.time)
      ) {
        next = { label, time: window.start.getTime() };
      }
    }
  }

  return { last: last?.label ?? null, next: next?.label ?? null };
};
