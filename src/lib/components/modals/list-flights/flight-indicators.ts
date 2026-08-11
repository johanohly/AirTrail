import { getFlightPassengerLabel, type FlightData } from '$lib/utils';

export type FlightIndicatorKey =
  'track' | 'actualTimes' | 'passengers' | 'note';

export type FlightIndicator = {
  key: FlightIndicatorKey;
  label: string;
};

const NOTE_PREVIEW_LENGTH = 160;

const companionsOf = (flight: FlightData, viewerId: string | null) => {
  if (!viewerId) {
    return flight.passengers.length > 1 ? flight.passengers : [];
  }
  return flight.passengers.filter((passenger) => passenger.userId !== viewerId);
};

export const buildFlightIndicators = (
  flight: FlightData,
  {
    hasTrack = false,
    viewerId = null,
  }: { hasTrack?: boolean; viewerId?: string | null } = {},
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

  const companions = companionsOf(flight, viewerId);
  if (companions.length) {
    const names = companions
      .map((passenger) => getFlightPassengerLabel(passenger))
      .filter((name): name is string => Boolean(name));
    const who = viewerId ? 'Also on board' : 'Passengers';
    indicators.push({
      key: 'passengers',
      label: names.length
        ? `${who}: ${names.join(', ')}`
        : `${companions.length} passenger${companions.length > 1 ? 's' : ''} recorded`,
    });
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
