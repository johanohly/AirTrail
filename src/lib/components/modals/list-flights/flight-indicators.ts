import type { FlightCustomFieldValue } from '$lib/db/types';
import { getFlightPassengerLabel, type FlightData } from '$lib/utils';
import {
  isCustomFieldValueEmpty,
  isEntityType,
  isTextLike,
  type CustomFieldDefinition,
} from '$lib/utils/custom-fields';

export type FlightIndicatorKey =
  'track' | 'actualTimes' | 'passengers' | 'note' | 'customFields';

export type FlightIndicator = {
  key: FlightIndicatorKey;
  label: string;
  /** Multi-line tooltip body, rendered one entry per line instead of `label`. */
  lines?: string[];
};

const NOTE_PREVIEW_LENGTH = 160;
const CUSTOM_FIELD_VALUE_PREVIEW_LENGTH = 100;

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

export const formatCustomFieldValue = (
  definition: Pick<CustomFieldDefinition, 'fieldType'>,
  entry: Pick<FlightCustomFieldValue, 'value' | 'valueLabel'>,
): string | null => {
  const value = entry.value;
  if (isCustomFieldValueEmpty(value)) return null;

  if (isEntityType(definition.fieldType)) {
    // Never surface a raw entity id — the name resolution happened server-side.
    return entry.valueLabel?.trim() || null;
  }
  if (isTextLike(definition.fieldType)) {
    const text = typeof value === 'string' ? value.trim() : '';
    return text
      ? truncatePreview(text, CUSTOM_FIELD_VALUE_PREVIEW_LENGTH)
      : null;
  }
  if (definition.fieldType === 'number') {
    return typeof value === 'number' && Number.isFinite(value)
      ? String(value)
      : null;
  }
  if (definition.fieldType === 'boolean') {
    return typeof value === 'boolean' ? (value ? 'Yes' : 'No') : null;
  }
  if (definition.fieldType === 'multi-select') {
    if (!Array.isArray(value)) return null;
    const joined = value
      .filter((item): item is string => typeof item === 'string')
      .join(', ');
    return joined
      ? truncatePreview(joined, CUSTOM_FIELD_VALUE_PREVIEW_LENGTH)
      : null;
  }
  // date and select values are plain strings, validated at write time
  const text = typeof value === 'string' ? value : '';
  return text || null;
};

export const buildCustomFieldsIndicator = (
  flight: FlightData,
  definitions: readonly CustomFieldDefinition[],
): FlightIndicator | null => {
  const entries = flight.customFields;
  if (!entries?.length || definitions.length === 0) return null;

  const entriesById = new Map(entries.map((entry) => [entry.fieldId, entry]));
  const lines: string[] = [];
  for (const definition of definitions) {
    const entry = entriesById.get(definition.id);
    if (!entry) continue;
    const formatted = formatCustomFieldValue(definition, entry);
    if (formatted === null) continue;
    lines.push(`${definition.label}: ${formatted}`);
  }
  if (lines.length === 0) return null;

  return {
    key: 'customFields',
    lines,
    label: truncatePreview(
      `Custom fields: ${lines.join('; ')}`,
      NOTE_PREVIEW_LENGTH,
    ),
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
    customFieldDefinitions = [],
  }: {
    hasTrack?: boolean;
    viewerId?: string | null;
    includePassengers?: boolean;
    customFieldDefinitions?: CustomFieldDefinition[];
  } = {},
): FlightIndicator[] => {
  return [
    hasTrack ? indicator('track', 'Flight track recorded') : null,
    buildActualTimesIndicator(flight),
    includePassengers ? buildPassengerIndicator(flight, viewerId) : null,
    buildNoteIndicator(flight),
    buildCustomFieldsIndicator(flight, customFieldDefinitions),
  ].filter(isIndicator);
};
