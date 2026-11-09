import type { FlightCustomFieldValue } from '$lib/db/types';
import { getFlightPassengerLabel, type FlightData } from '$lib/utils';
import { isCustomFieldValueEmpty } from '$lib/utils/custom-fields';
import { formatDate } from '$lib/utils/preferences';
import type { Preferences } from '$lib/zod/user';

type DatePrefs = Pick<Preferences, 'dateFormat'>;

export type FlightIndicatorKey =
  'track' | 'actualTimes' | 'passengers' | 'note' | 'customFields';

export type FlightIndicator = {
  key: FlightIndicatorKey;
  label: string;
  /** Tooltip lines, shown instead of `label`. */
  lines?: string[];
};

const NOTE_PREVIEW_LENGTH = 160;
const CUSTOM_FIELD_PREVIEW_LENGTH = 100;

const indicator = (
  key: FlightIndicatorKey,
  label: string,
): FlightIndicator => ({ key, label });

const truncatePreview = (text: string, maxLength: number) => {
  const characters = Array.from(text);
  return characters.length > maxLength
    ? `${characters.slice(0, maxLength).join('').trimEnd()}…`
    : text;
};

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

  return indicator(
    'note',
    `Note: ${truncatePreview(note, NOTE_PREVIEW_LENGTH)}`,
  );
};

const formatCustomFieldValue = (
  { fieldType, value }: FlightCustomFieldValue,
  prefs?: DatePrefs,
): string | null => {
  if (isCustomFieldValueEmpty(value)) return null;

  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) value = value.join(', ');
  if (fieldType === 'date' && prefs && typeof value === 'string') {
    const date = new Date(`${value}T00:00:00Z`);
    if (!Number.isNaN(date.getTime())) value = formatDate(date, prefs, 'UTC');
  }
  const text = String(value).trim();
  return text ? truncatePreview(text, CUSTOM_FIELD_PREVIEW_LENGTH) : null;
};

const buildCustomFieldsIndicator = (
  flight: FlightData,
  prefs?: DatePrefs,
): FlightIndicator | null => {
  const lines = (flight.customFieldValues ?? []).flatMap((entry) => {
    const formatted = formatCustomFieldValue(entry, prefs);
    return formatted ? [`${entry.label}: ${formatted}`] : [];
  });
  if (!lines.length) return null;

  return {
    key: 'customFields',
    label: truncatePreview(
      `Custom fields: ${lines.join('; ')}`,
      NOTE_PREVIEW_LENGTH,
    ),
    lines,
  };
};

const isIndicator = (value: FlightIndicator | null): value is FlightIndicator =>
  value !== null;

export const buildFlightIndicators = (
  flight: FlightData,
  {
    hasTrack = false,
    viewerId = null,
    includePassengers = true,
    datePrefs,
  }: {
    hasTrack?: boolean;
    viewerId?: string | null;
    includePassengers?: boolean;
    datePrefs?: DatePrefs;
  } = {},
): FlightIndicator[] => {
  return [
    hasTrack ? indicator('track', 'Flight track recorded') : null,
    buildActualTimesIndicator(flight),
    includePassengers ? buildPassengerIndicator(flight, viewerId) : null,
    buildNoteIndicator(flight),
    buildCustomFieldsIndicator(flight, datePrefs),
  ].filter(isIndicator);
};
