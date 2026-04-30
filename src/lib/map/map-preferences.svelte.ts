import { browser } from '$app/environment';

import {
  OPENAIP_DEFAULT_ENABLED_GROUPS,
  OPENAIP_OVERLAY_GROUPS,
  type OpenAipOverlayGroup,
} from './openaip';
import { MAP_BASEMAPS, type MapBasemap } from './basemap';

export type AirportCirclesMode = 'off' | 'small' | 'medium' | 'large';
export type ArcColorMode = 'default' | 'byFrequency';
export type ArcThicknessMode = 'uniform' | 'byFrequency';
export type ArcThicknessScale = 'thin' | 'normal' | 'thick';
export type AirportOverlayDetail = 'standard' | 'detailed';

export type MapPreferences = {
  basemap: MapBasemap;
  airportCircles: AirportCirclesMode;
  arcColor: ArcColorMode;
  arcThickness: ArcThicknessMode;
  arcThicknessScale: ArcThicknessScale;
  airportOverlayDetail: AirportOverlayDetail;
  openAipEnabled: boolean;
  openAipGroups: OpenAipOverlayGroup[];
};

const STORAGE_KEY = 'airtrail:map:prefs';
const LEGACY_OPENAIP_KEY = 'airtrail:map:openaip-overlay';

const AIRPORT_CIRCLES_MODES: readonly AirportCirclesMode[] = [
  'off',
  'small',
  'medium',
  'large',
];
const ARC_COLOR_MODES: readonly ArcColorMode[] = [
  'default',
  'byFrequency',
];
const ARC_THICKNESS_MODES: readonly ArcThicknessMode[] = [
  'uniform',
  'byFrequency',
];
const ARC_THICKNESS_SCALES: readonly ArcThicknessScale[] = [
  'thin',
  'normal',
  'thick',
];
const AIRPORT_OVERLAY_DETAIL_MODES: readonly AirportOverlayDetail[] = [
  'standard',
  'detailed',
];

export const MAP_PREFERENCE_DEFAULTS: MapPreferences = {
  basemap: 'default',
  airportCircles: 'large',
  arcColor: 'default',
  arcThickness: 'uniform',
  arcThicknessScale: 'normal',
  airportOverlayDetail: 'detailed',
  openAipEnabled: false,
  openAipGroups: [...OPENAIP_DEFAULT_ENABLED_GROUPS],
};

export const mapPreferences = $state<MapPreferences>({
  ...MAP_PREFERENCE_DEFAULTS,
  openAipGroups: [...MAP_PREFERENCE_DEFAULTS.openAipGroups],
});

const sanitize = (raw: unknown): MapPreferences => {
  const result: MapPreferences = {
    ...MAP_PREFERENCE_DEFAULTS,
    openAipGroups: [...MAP_PREFERENCE_DEFAULTS.openAipGroups],
  };

  if (!raw || typeof raw !== 'object') return result;
  const input = raw as Partial<Record<keyof MapPreferences, unknown>>;

  if (
    typeof input.basemap === 'string' &&
    MAP_BASEMAPS.includes(input.basemap as MapBasemap)
  ) {
    result.basemap = input.basemap as MapBasemap;
  }
  if (
    typeof input.airportCircles === 'string' &&
    AIRPORT_CIRCLES_MODES.includes(input.airportCircles as AirportCirclesMode)
  ) {
    result.airportCircles = input.airportCircles as AirportCirclesMode;
  }
  if (
    typeof input.arcColor === 'string' &&
    ARC_COLOR_MODES.includes(input.arcColor as ArcColorMode)
  ) {
    result.arcColor = input.arcColor as ArcColorMode;
  }
  if (
    typeof input.arcThickness === 'string' &&
    ARC_THICKNESS_MODES.includes(input.arcThickness as ArcThicknessMode)
  ) {
    result.arcThickness = input.arcThickness as ArcThicknessMode;
  }
  if (
    typeof input.arcThicknessScale === 'string' &&
    ARC_THICKNESS_SCALES.includes(input.arcThicknessScale as ArcThicknessScale)
  ) {
    result.arcThicknessScale = input.arcThicknessScale as ArcThicknessScale;
  }
  if (
    typeof input.airportOverlayDetail === 'string' &&
    AIRPORT_OVERLAY_DETAIL_MODES.includes(
      input.airportOverlayDetail as AirportOverlayDetail,
    )
  ) {
    result.airportOverlayDetail =
      input.airportOverlayDetail as AirportOverlayDetail;
  }
  if (typeof input.openAipEnabled === 'boolean') {
    result.openAipEnabled = input.openAipEnabled;
  }
  if (Array.isArray(input.openAipGroups)) {
    const validGroups = new Set<string>(OPENAIP_OVERLAY_GROUPS);
    result.openAipGroups = input.openAipGroups.filter(
      (g): g is OpenAipOverlayGroup =>
        typeof g === 'string' && validGroups.has(g),
    );
  }

  return result;
};

let initialized = false;

export const initMapPreferences = () => {
  if (!browser || initialized) return;
  initialized = true;

  let parsed: unknown = undefined;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) parsed = JSON.parse(raw);
  } catch {
    // corrupt JSON — fall through to defaults
  }

  const legacyOpenAip = localStorage.getItem(LEGACY_OPENAIP_KEY);
  if (legacyOpenAip !== null) {
    const legacyValue = legacyOpenAip === 'true';
    const base =
      parsed && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)
        : {};
    if (!('openAipEnabled' in base)) {
      parsed = { ...base, openAipEnabled: legacyValue };
    }
    localStorage.removeItem(LEGACY_OPENAIP_KEY);
  }

  const hydrated = sanitize(parsed);
  mapPreferences.basemap = hydrated.basemap;
  mapPreferences.airportCircles = hydrated.airportCircles;
  mapPreferences.arcColor = hydrated.arcColor;
  mapPreferences.arcThickness = hydrated.arcThickness;
  mapPreferences.arcThicknessScale = hydrated.arcThicknessScale;
  mapPreferences.airportOverlayDetail = hydrated.airportOverlayDetail;
  mapPreferences.openAipEnabled = hydrated.openAipEnabled;
  mapPreferences.openAipGroups = hydrated.openAipGroups;

  $effect.root(() => {
    $effect(() => {
      const snapshot: MapPreferences = {
        basemap: mapPreferences.basemap,
        airportCircles: mapPreferences.airportCircles,
        arcColor: mapPreferences.arcColor,
        arcThickness: mapPreferences.arcThickness,
        arcThicknessScale: mapPreferences.arcThicknessScale,
        airportOverlayDetail: mapPreferences.airportOverlayDetail,
        openAipEnabled: mapPreferences.openAipEnabled,
        openAipGroups: [...mapPreferences.openAipGroups],
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      } catch {
        // quota or private mode — ignore
      }
    });
  });
};

export const resetMapPreferences = () => {
  mapPreferences.basemap = MAP_PREFERENCE_DEFAULTS.basemap;
  mapPreferences.airportCircles = MAP_PREFERENCE_DEFAULTS.airportCircles;
  mapPreferences.arcColor = MAP_PREFERENCE_DEFAULTS.arcColor;
  mapPreferences.arcThickness = MAP_PREFERENCE_DEFAULTS.arcThickness;
  mapPreferences.arcThicknessScale = MAP_PREFERENCE_DEFAULTS.arcThicknessScale;
  mapPreferences.airportOverlayDetail =
    MAP_PREFERENCE_DEFAULTS.airportOverlayDetail;
  mapPreferences.openAipEnabled = MAP_PREFERENCE_DEFAULTS.openAipEnabled;
  mapPreferences.openAipGroups = [...MAP_PREFERENCE_DEFAULTS.openAipGroups];
};

export const toggleOpenAipGroup = (group: OpenAipOverlayGroup) => {
  const current = mapPreferences.openAipGroups;
  if (current.includes(group)) {
    mapPreferences.openAipGroups = current.filter((g) => g !== group);
  } else {
    mapPreferences.openAipGroups = [...current, group];
  }
};
