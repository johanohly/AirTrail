import type { Preferences } from '$lib/zod/user';

export type PresetKey = 'metric' | 'imperial' | 'aviation';

export interface Preset {
  key: PresetKey;
  label: string;
  description: string;
  values: Preferences;
}

const FLIGHT_TIME_DISPLAY_DEFAULT: Preferences['flightTimeDisplay'] = 'airport';

export const presets: Record<PresetKey, Preset> = {
  metric: {
    key: 'metric',
    label: 'Metric',
    description: 'Kilometers, °C, 24-hour clock. Common in most of the world.',
    values: {
      distanceUnit: 'km',
      windSpeedUnit: 'kmh',
      temperatureUnit: 'c',
      pressureUnit: 'hpa',
      timeFormat: '24h',
      dateFormat: 'eu',
      weekStartsOn: 'mon',
      flightTimeDisplay: FLIGHT_TIME_DISPLAY_DEFAULT,
    },
  },
  imperial: {
    key: 'imperial',
    label: 'Imperial',
    description: 'Miles, °F, 12-hour clock. Common in the US.',
    values: {
      distanceUnit: 'mi',
      windSpeedUnit: 'mph',
      temperatureUnit: 'f',
      pressureUnit: 'inhg',
      timeFormat: '12h',
      dateFormat: 'us',
      weekStartsOn: 'sun',
      flightTimeDisplay: FLIGHT_TIME_DISPLAY_DEFAULT,
    },
  },
  aviation: {
    key: 'aviation',
    label: 'Aviation',
    description: 'Nautical miles, knots, °C, hPa, ISO dates. Pilot and METAR conventions.',
    values: {
      distanceUnit: 'nm',
      windSpeedUnit: 'kt',
      temperatureUnit: 'c',
      pressureUnit: 'hpa',
      timeFormat: '24h',
      dateFormat: 'iso',
      weekStartsOn: 'mon',
      flightTimeDisplay: FLIGHT_TIME_DISPLAY_DEFAULT,
    },
  },
};

export const presetList: Preset[] = [
  presets.metric,
  presets.imperial,
  presets.aviation,
];

/**
 * Returns the key of the preset that matches the given preferences exactly,
 * or null if none do (i.e. the user has a custom mix).
 */
export const matchPreset = (prefs: Preferences): PresetKey | null => {
  for (const preset of presetList) {
    const v = preset.values;
    if (
      v.distanceUnit === prefs.distanceUnit &&
      v.windSpeedUnit === prefs.windSpeedUnit &&
      v.temperatureUnit === prefs.temperatureUnit &&
      v.pressureUnit === prefs.pressureUnit &&
      v.timeFormat === prefs.timeFormat &&
      v.dateFormat === prefs.dateFormat &&
      v.weekStartsOn === prefs.weekStartsOn &&
      v.flightTimeDisplay === prefs.flightTimeDisplay
    ) {
      return preset.key;
    }
  }
  return null;
};
