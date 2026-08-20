import { getFlightPassengerLabel, type FlightData } from '$lib/utils';

export type FlightIndicatorKey =
  'track' | 'actualTimes' | 'passengers' | 'note';

export type FlightIndicator = {
  key: FlightIndicatorKey;
  label: string;
};

const NOTE_PREVIEW_LENGTH = 160;

const indicator = (
  key: FlightIndicatorKey,
  label: string,
): FlightIndicator => ({ key, label });

const companionsOf = (flight: FlightData, viewerId: string | null) => {
  if (!viewerId) {
    return flight.passengers.length > 1 ? flight.passengers : [];
  }
  return flight.passengers.filter((passenger) => passenger.userId !== viewerId);
};

const buildActualTimesIndicator = (
  flight: FlightData,
): FlightIndicator | null => {
  const hasDeparture = Boolean(flight.departure ?? flight.raw.takeoffActual);
  const hasArrival = Boolean(flight.arrival ?? flight.raw.landingActual);

  if (hasDeparture && hasArrival) {
    return indicator(
      'actualTimes',
      'Actual departure and arrival times recorded',
    );
  }
  if (hasDeparture) {
    return indicator('actualTimes', 'Actual departure time recorded');
  }
  if (hasArrival) {
    return indicator('actualTimes', 'Actual arrival time recorded');
  }
  return null;
};

const passengerCountLabel = (count: number) =>
  `${count} passenger${count === 1 ? '' : 's'} recorded`;

const buildPassengerIndicator = (
  flight: FlightData,
  viewerId: string | null,
): FlightIndicator | null => {
  const companions = companionsOf(flight, viewerId);
  if (!companions.length) return null;

  const names = companions
    .map((passenger) => getFlightPassengerLabel(passenger))
    .filter((name): name is string => Boolean(name));
  if (!names.length) {
    return indicator('passengers', passengerCountLabel(companions.length));
  }

  const who = viewerId ? 'Also on board' : 'Passengers';
  const unnamedCount = companions.length - names.length;
  const unnamedSuffix = unnamedCount ? ` +${unnamedCount}` : '';
  return indicator('passengers', `${who}: ${names.join(', ')}${unnamedSuffix}`);
};

const buildNoteIndicator = (flight: FlightData): FlightIndicator | null => {
  const note = flight.note?.trim();
  if (!note) return null;

  const characters = Array.from(note);
  const preview =
    characters.length > NOTE_PREVIEW_LENGTH
      ? `${characters.slice(0, NOTE_PREVIEW_LENGTH).join('').trimEnd()}…`
      : note;
  return indicator('note', `Note: ${preview}`);
};

const isIndicator = (value: FlightIndicator | null): value is FlightIndicator =>
  value !== null;

export const buildFlightIndicators = (
  flight: FlightData,
  {
    hasTrack = false,
    viewerId = null,
  }: { hasTrack?: boolean; viewerId?: string | null } = {},
): FlightIndicator[] => {
  return [
    hasTrack ? indicator('track', 'Flight track recorded') : null,
    buildActualTimesIndicator(flight),
    buildPassengerIndicator(flight, viewerId),
    buildNoteIndicator(flight),
  ].filter(isIndicator);
};
