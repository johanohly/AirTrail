import { browser } from '$app/environment';

import {
  OPENAIP_DEFAULT_ENABLED_GROUPS,
  OPENAIP_OVERLAY_GROUPS,
  type OpenAipOverlayGroup,
} from './openaip';
import { MAP_BASEMAPS, type MapBasemap } from './basemap';
import type { FlightTrackPalette } from './flight-track-style';

export type { FlightTrackPalette } from './flight-track-style';

export type AirportCirclesMode = 'off' | 'small' | 'medium' | 'large';
export type AirportCircleRadiusMode = 'byFrequency' | 'uniform';
export type ArcColorMode = 'default' | 'byFrequency';
export type ArcThicknessMode = 'uniform' | 'byFrequency';
export type ArcThicknessScale = 'thin' | 'normal' | 'thick';
export type RouteDisplayMode = 'points' | 'tracks';
export type FlightTrackStyle = 'standard' | 'altitude';
export type AirportOverlayDetail = 'standard' | 'detailed';
export type MapProjection = 'mercator' | 'globe';

export type MapPreferences = {
  basemap: MapBasemap;
  projection: MapProjection;
  timeOfDayEnabled: boolean;
  rainViewerEnabled: boolean;
  airportCircles: AirportCirclesMode;
  airportCircleRadius: AirportCircleRadiusMode;
  arcColor: ArcColorMode;
  arcThickness: ArcThicknessMode;
  arcThicknessScale: ArcThicknessScale;
  routeDisplay: RouteDisplayMode;
  flightTrackStyle: FlightTrackStyle;
  flightTrackPalette: FlightTrackPalette;
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
const AIRPORT_CIRCLE_RADIUS_MODES: readonly AirportCircleRadiusMode[] = [
  'byFrequency',
  'uniform',
];
const ARC_COLOR_MODES: readonly ArcColorMode[] = ['default', 'byFrequency'];
const ARC_THICKNESS_MODES: readonly ArcThicknessMode[] = [
  'uniform',
  'byFrequency',
];
const ARC_THICKNESS_SCALES: readonly ArcThicknessScale[] = [
  'thin',
  'normal',
  'thick',
];
const ROUTE_DISPLAY_MODES: readonly RouteDisplayMode[] = ['points', 'tracks'];
const FLIGHT_TRACK_STYLES: readonly FlightTrackStyle[] = [
  'standard',
  'altitude',
];
const FLIGHT_TRACK_PALETTES: readonly FlightTrackPalette[] = [
  'tar1090',
  'airtrail',
];
const AIRPORT_OVERLAY_DETAIL_MODES: readonly AirportOverlayDetail[] = [
  'standard',
  'detailed',
];
const MAP_PROJECTIONS: readonly MapProjection[] = ['mercator', 'globe'];

export const MAP_PREFERENCE_DEFAULTS: MapPreferences = {
  basemap: 'default',
  projection: 'mercator',
  timeOfDayEnabled: false,
  rainViewerEnabled: false,
  airportCircles: 'large',
  airportCircleRadius: 'byFrequency',
  arcColor: 'default',
  arcThickness: 'uniform',
  arcThicknessScale: 'normal',
  routeDisplay: 'tracks',
  flightTrackStyle: 'standard',
  flightTrackPalette: 'tar1090',
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
    typeof input.projection === 'string' &&
    MAP_PROJECTIONS.includes(input.projection as MapProjection)
  ) {
    result.projection = input.projection as MapProjection;
  }
  if (typeof input.timeOfDayEnabled === 'boolean') {
    result.timeOfDayEnabled = input.timeOfDayEnabled;
  }
  if (typeof input.rainViewerEnabled === 'boolean') {
    result.rainViewerEnabled = input.rainViewerEnabled;
  }
  if (
    typeof input.airportCircles === 'string' &&
    AIRPORT_CIRCLES_MODES.includes(input.airportCircles as AirportCirclesMode)
  ) {
    result.airportCircles = input.airportCircles as AirportCirclesMode;
  }
  if (
    typeof input.airportCircleRadius === 'string' &&
    AIRPORT_CIRCLE_RADIUS_MODES.includes(
      input.airportCircleRadius as AirportCircleRadiusMode,
    )
  ) {
    result.airportCircleRadius =
      input.airportCircleRadius as AirportCircleRadiusMode;
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
    typeof input.routeDisplay === 'string' &&
    ROUTE_DISPLAY_MODES.includes(input.routeDisplay as RouteDisplayMode)
  ) {
    result.routeDisplay = input.routeDisplay as RouteDisplayMode;
  }
  if (
    typeof input.flightTrackStyle === 'string' &&
    FLIGHT_TRACK_STYLES.includes(input.flightTrackStyle as FlightTrackStyle)
  ) {
    result.flightTrackStyle = input.flightTrackStyle as FlightTrackStyle;
  }
  if (
    typeof input.flightTrackPalette === 'string' &&
    FLIGHT_TRACK_PALETTES.includes(
      input.flightTrackPalette as FlightTrackPalette,
    )
  ) {
    result.flightTrackPalette = input.flightTrackPalette as FlightTrackPalette;
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
  mapPreferences.projection = hydrated.projection;
  mapPreferences.timeOfDayEnabled = hydrated.timeOfDayEnabled;
  mapPreferences.rainViewerEnabled = hydrated.rainViewerEnabled;
  mapPreferences.airportCircles = hydrated.airportCircles;
  mapPreferences.airportCircleRadius = hydrated.airportCircleRadius;
  mapPreferences.arcColor = hydrated.arcColor;
  mapPreferences.arcThickness = hydrated.arcThickness;
  mapPreferences.arcThicknessScale = hydrated.arcThicknessScale;
  mapPreferences.routeDisplay = hydrated.routeDisplay;
  mapPreferences.flightTrackStyle = hydrated.flightTrackStyle;
  mapPreferences.flightTrackPalette = hydrated.flightTrackPalette;
  mapPreferences.airportOverlayDetail = hydrated.airportOverlayDetail;
  mapPreferences.openAipEnabled = hydrated.openAipEnabled;
  mapPreferences.openAipGroups = hydrated.openAipGroups;

  $effect.root(() => {
    $effect(() => {
      const snapshot: MapPreferences = {
        basemap: mapPreferences.basemap,
        projection: mapPreferences.projection,
        timeOfDayEnabled: mapPreferences.timeOfDayEnabled,
        rainViewerEnabled: mapPreferences.rainViewerEnabled,
        airportCircles: mapPreferences.airportCircles,
        airportCircleRadius: mapPreferences.airportCircleRadius,
        arcColor: mapPreferences.arcColor,
        arcThickness: mapPreferences.arcThickness,
        arcThicknessScale: mapPreferences.arcThicknessScale,
        routeDisplay: mapPreferences.routeDisplay,
        flightTrackStyle: mapPreferences.flightTrackStyle,
        flightTrackPalette: mapPreferences.flightTrackPalette,
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
  mapPreferences.projection = MAP_PREFERENCE_DEFAULTS.projection;
  mapPreferences.timeOfDayEnabled = MAP_PREFERENCE_DEFAULTS.timeOfDayEnabled;
  mapPreferences.rainViewerEnabled = MAP_PREFERENCE_DEFAULTS.rainViewerEnabled;
  mapPreferences.airportCircles = MAP_PREFERENCE_DEFAULTS.airportCircles;
  mapPreferences.airportCircleRadius =
    MAP_PREFERENCE_DEFAULTS.airportCircleRadius;
  mapPreferences.arcColor = MAP_PREFERENCE_DEFAULTS.arcColor;
  mapPreferences.arcThickness = MAP_PREFERENCE_DEFAULTS.arcThickness;
  mapPreferences.arcThicknessScale = MAP_PREFERENCE_DEFAULTS.arcThicknessScale;
  mapPreferences.routeDisplay = MAP_PREFERENCE_DEFAULTS.routeDisplay;
  mapPreferences.flightTrackStyle = MAP_PREFERENCE_DEFAULTS.flightTrackStyle;
  mapPreferences.flightTrackPalette =
    MAP_PREFERENCE_DEFAULTS.flightTrackPalette;
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
