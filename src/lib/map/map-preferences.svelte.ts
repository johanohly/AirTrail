import { MAP_BASEMAPS, type MapBasemap } from './basemap';
import {
  OPENAIP_DEFAULT_ENABLED_GROUPS,
  OPENAIP_OVERLAY_GROUPS,
  type OpenAipOverlayGroup,
} from './openaip';

import { browser } from '$app/environment';

export type AppearanceOption<T extends string> = {
  value: T;
  label: string;
};

const airportCircleOptions = [
  { value: 'off', label: 'Off' },
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
] as const;
const airportCircleRadiusOptions = [
  { value: 'byFrequency', label: 'By frequency' },
  { value: 'uniform', label: 'Uniform' },
] as const;
const arcColorOptions = [
  { value: 'default', label: 'Default' },
  { value: 'byFrequency', label: 'By frequency' },
] as const;
const arcThicknessOptions = [
  { value: 'uniform', label: 'Uniform' },
  { value: 'byFrequency', label: 'By frequency' },
] as const;
const arcThicknessScaleOptions = [
  { value: 'thin', label: 'Thin' },
  { value: 'normal', label: 'Normal' },
  { value: 'thick', label: 'Thick' },
] as const;
const routeDisplayOptions = [
  { value: 'tracks', label: 'Flight tracks' },
  { value: 'points', label: 'Point to point' },
] as const;
const flightTrackStyleOptions = [
  { value: 'standard', label: 'Standard' },
  { value: 'altitude', label: 'Altitude' },
] as const;
const airportOverlayDetailOptions = [
  { value: 'standard', label: 'Standard' },
  { value: 'detailed', label: 'Detailed' },
] as const;
const projectionOptions = [
  { value: 'mercator', label: 'Flat' },
  { value: 'globe', label: 'Globe' },
] as const;
const basemapLabels = {
  default: 'Default',
  satellite: 'Satellite',
} as const satisfies Record<MapBasemap, string>;
const basemapOptions = MAP_BASEMAPS.map((value) => ({
  value,
  label: basemapLabels[value],
}));

const openAipGroupLabels = {
  airspaces: 'Airspaces',
  airspaceLabels: 'Airspace labels',
  airports: 'Airports',
  navaids: 'Navaids',
  reportingPoints: 'Reporting points',
} as const satisfies Record<OpenAipOverlayGroup, string>;
const openAipGroupOptions = OPENAIP_OVERLAY_GROUPS.map((value) => ({
  value,
  label: openAipGroupLabels[value],
}));

type OptionValue<T extends readonly AppearanceOption<string>[]> =
  T[number]['value'];

export type AirportCirclesMode = OptionValue<typeof airportCircleOptions>;
export type AirportCircleRadiusMode = OptionValue<
  typeof airportCircleRadiusOptions
>;
export type ArcColorMode = OptionValue<typeof arcColorOptions>;
export type ArcThicknessMode = OptionValue<typeof arcThicknessOptions>;
export type ArcThicknessScale = OptionValue<typeof arcThicknessScaleOptions>;
export type RouteDisplayMode = OptionValue<typeof routeDisplayOptions>;
export type FlightTrackStyle = OptionValue<typeof flightTrackStyleOptions>;
export type AirportOverlayDetail = OptionValue<
  typeof airportOverlayDetailOptions
>;
export type MapProjection = OptionValue<typeof projectionOptions>;

type PreferenceDefinition<T> = {
  defaultValue: T;
  sanitize: (raw: unknown) => T;
};

const choicePreference = <T extends string>(
  options: readonly AppearanceOption<T>[],
  defaultValue: T,
): PreferenceDefinition<T> & { options: readonly AppearanceOption<T>[] } => {
  const values = new Set(options.map((option) => option.value));
  return {
    defaultValue,
    options,
    sanitize: (raw) =>
      typeof raw === 'string' && values.has(raw as T)
        ? (raw as T)
        : defaultValue,
  };
};

const booleanPreference = (
  defaultValue: boolean,
): PreferenceDefinition<boolean> => ({
  defaultValue,
  sanitize: (raw) => (typeof raw === 'boolean' ? raw : defaultValue),
});

const choiceArrayPreference = <T extends string>(
  options: readonly AppearanceOption<T>[],
  defaultValue: readonly T[],
): PreferenceDefinition<T[]> & { options: readonly AppearanceOption<T>[] } => {
  const values = new Set(options.map((option) => option.value));
  return {
    defaultValue: [...defaultValue],
    options,
    sanitize: (raw) =>
      Array.isArray(raw)
        ? raw.filter(
            (value): value is T =>
              typeof value === 'string' && values.has(value as T),
          )
        : [...defaultValue],
  };
};

export const MAP_PREFERENCE_DEFINITIONS = {
  basemap: choicePreference(basemapOptions, 'default'),
  projection: choicePreference(projectionOptions, 'mercator'),
  timeOfDayEnabled: booleanPreference(false),
  rainViewerEnabled: booleanPreference(false),
  airportCircles: choicePreference(airportCircleOptions, 'large'),
  airportCircleRadius: choicePreference(
    airportCircleRadiusOptions,
    'byFrequency',
  ),
  arcColor: choicePreference(arcColorOptions, 'default'),
  arcThickness: choicePreference(arcThicknessOptions, 'uniform'),
  arcThicknessScale: choicePreference(arcThicknessScaleOptions, 'normal'),
  routeDisplay: choicePreference(routeDisplayOptions, 'tracks'),
  flightTrackStyle: choicePreference(flightTrackStyleOptions, 'standard'),
  airportOverlayDetail: choicePreference(
    airportOverlayDetailOptions,
    'detailed',
  ),
  openAipEnabled: booleanPreference(false),
  openAipGroups: choiceArrayPreference(
    openAipGroupOptions,
    OPENAIP_DEFAULT_ENABLED_GROUPS,
  ),
} as const;

type DefinitionValue<T> =
  T extends PreferenceDefinition<infer Value> ? Value : never;

export type MapPreferences = {
  -readonly [Key in keyof typeof MAP_PREFERENCE_DEFINITIONS]: DefinitionValue<
    (typeof MAP_PREFERENCE_DEFINITIONS)[Key]
  >;
};

const preferenceKeys = Object.keys(
  MAP_PREFERENCE_DEFINITIONS,
) as (keyof MapPreferences)[];

const clonePreferenceValue = <T>(value: T): T =>
  (Array.isArray(value) ? [...value] : value) as T;

const buildDefaults = () =>
  Object.fromEntries(
    preferenceKeys.map((key) => [
      key,
      clonePreferenceValue(MAP_PREFERENCE_DEFINITIONS[key].defaultValue),
    ]),
  ) as MapPreferences;

export const MAP_PREFERENCE_DEFAULTS = buildDefaults();
export const mapPreferences = $state<MapPreferences>(buildDefaults());

export const sanitizeMapPreferences = (raw: unknown): MapPreferences => {
  const input =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(
    preferenceKeys.map((key) => [
      key,
      MAP_PREFERENCE_DEFINITIONS[key].sanitize(input[key]),
    ]),
  ) as MapPreferences;
};

const assignMapPreferences = (preferences: MapPreferences) => {
  Object.assign(mapPreferences, preferences);
};

const STORAGE_KEY = 'airtrail:map:prefs';
const LEGACY_OPENAIP_KEY = 'airtrail:map:openaip-overlay';
let initialized = false;

export const initMapPreferences = () => {
  if (!browser || initialized) return;
  initialized = true;

  let parsed: unknown;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) parsed = JSON.parse(raw);
  } catch {
    // Corrupt JSON falls back to defaults.
  }

  const legacyOpenAip = localStorage.getItem(LEGACY_OPENAIP_KEY);
  if (legacyOpenAip !== null) {
    const base =
      parsed && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)
        : {};
    if (!('openAipEnabled' in base)) {
      parsed = { ...base, openAipEnabled: legacyOpenAip === 'true' };
    }
    localStorage.removeItem(LEGACY_OPENAIP_KEY);
  }

  assignMapPreferences(sanitizeMapPreferences(parsed));

  $effect.root(() => {
    $effect(() => {
      const snapshot = sanitizeMapPreferences(mapPreferences);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      } catch {
        // Storage can fail in private mode or when quota is exhausted.
      }
    });
  });
};

export const resetMapPreferences = () => {
  assignMapPreferences(buildDefaults());
};

export const toggleOpenAipGroup = (group: OpenAipOverlayGroup) => {
  const current = mapPreferences.openAipGroups;
  mapPreferences.openAipGroups = current.includes(group)
    ? current.filter((value) => value !== group)
    : [...current, group];
};
