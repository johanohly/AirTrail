import type { FlightData } from '$lib/utils';

export type FlightIndicatorKey = 'track' | 'actualTimes' | 'note';

export type FlightIndicator = {
  key: FlightIndicatorKey;
  label: string;
};

const NOTE_PREVIEW_LENGTH = 160;

export const buildFlightIndicators = (
  flight: FlightData,
  { hasTrack = false }: { hasTrack?: boolean } = {},
): FlightIndicator[] => {
  const indicators: FlightIndicator[] = [];

  if (hasTrack) {
    indicators.push({ key: 'track', label: 'Flight track recorded' });
  }

  const hasActualDeparture = Boolean(
    flight.departure ?? flight.raw.takeoffActual,
  );
  const hasActualArrival = Boolean(flight.arrival ?? flight.raw.landingActual);
  if (hasActualDeparture || hasActualArrival) {
    const what =
      hasActualDeparture && hasActualArrival
        ? 'departure and arrival times'
        : hasActualDeparture
          ? 'departure time'
          : 'arrival time';
    indicators.push({ key: 'actualTimes', label: `Actual ${what} recorded` });
  }

  const note = flight.note?.trim();
  if (note) {
    const preview =
      note.length > NOTE_PREVIEW_LENGTH
        ? `${note.slice(0, NOTE_PREVIEW_LENGTH).trimEnd()}…`
        : note;
    indicators.push({ key: 'note', label: `Note: ${preview}` });
  }

  return indicators;
};
