// Display metadata for each preference value: the label shown in field
// components. Kept here (not in the field components) so popovers, settings
// page, and the user-list summary can render the same labels.

import type {
  DateFormat,
  DistanceUnit,
  FlightTimeDisplay,
  PressureUnit,
  TemperatureUnit,
  TimeFormat,
  WeekStartsOn,
  WindSpeedUnit,
} from '$lib/zod/user';

export interface Option<T extends string> {
  value: T;
  label: string;
  /** Short text shown next to the label (in trigger and menu). Unit symbols, sample formats, etc. */
  hint?: string;
  /** Longer explanation, shown only in dropdown menu items below the label. */
  description?: string;
}

export const distanceUnitOptions: Option<DistanceUnit>[] = [
  { value: 'km', label: 'Kilometers', hint: 'km' },
  { value: 'mi', label: 'Miles', hint: 'mi' },
  { value: 'nm', label: 'Nautical miles', hint: 'nm' },
];

export const windSpeedUnitOptions: Option<WindSpeedUnit>[] = [
  { value: 'kt', label: 'Knots', hint: 'kt' },
  { value: 'kmh', label: 'Kilometers per hour', hint: 'km/h' },
  { value: 'mph', label: 'Miles per hour', hint: 'mph' },
  { value: 'ms', label: 'Meters per second', hint: 'm/s' },
];

export const temperatureUnitOptions: Option<TemperatureUnit>[] = [
  { value: 'c', label: 'Celsius', hint: '°C' },
  { value: 'f', label: 'Fahrenheit', hint: '°F' },
];

export const pressureUnitOptions: Option<PressureUnit>[] = [
  { value: 'hpa', label: 'Hectopascals', hint: 'hPa' },
  { value: 'inhg', label: 'Inches of mercury', hint: 'inHg' },
];

export const timeFormatOptions: Option<TimeFormat>[] = [
  { value: 'auto', label: 'Auto', hint: 'Follow system' },
  { value: '24h', label: '24-hour', hint: '14:30' },
  { value: '12h', label: '12-hour', hint: '2:30 PM' },
];

export const dateFormatOptions: Option<DateFormat>[] = [
  { value: 'auto', label: 'Auto', hint: 'Follow system' },
  { value: 'iso', label: 'ISO', hint: '2026-04-26' },
  { value: 'eu', label: 'European', hint: '26/04/2026' },
  { value: 'us', label: 'US', hint: '04/26/2026' },
];

export const weekStartsOnOptions: Option<WeekStartsOn>[] = [
  { value: 'auto', label: 'Auto', hint: 'Follow system' },
  { value: 'mon', label: 'Monday' },
  { value: 'sun', label: 'Sunday' },
];

export const flightTimeDisplayOptions: Option<FlightTimeDisplay>[] = [
  {
    value: 'airport',
    label: 'Airport local time',
    description: 'Times shown in each airport\'s timezone',
  },
  {
    value: 'utc',
    label: 'UTC',
    description: 'All times in UTC',
  },
  {
    value: 'system',
    label: 'My system timezone',
    description: 'Convert all times to your device\'s timezone',
  },
];
