import type { MapBasemap } from '$lib/map/basemap';
import {
  type AirportCircleRadiusMode,
  type AirportCirclesMode,
  type AirportOverlayDetail,
  type ArcColorMode,
  type ArcThicknessMode,
  type ArcThicknessScale,
  type MapProjection,
  type RouteDisplayMode,
} from '$lib/map/map-preferences.svelte';
import {
  OPENAIP_OVERLAY_GROUPS,
  type OpenAipOverlayGroup,
} from '$lib/map/openaip';

type AppearanceOption<T extends string> = {
  value: T;
  label: string;
};

export const AIRPORT_CIRCLE_OPTIONS: Array<
  AppearanceOption<AirportCirclesMode>
> = [
  { value: 'off', label: 'Off' },
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

export const AIRPORT_CIRCLE_RADIUS_OPTIONS: Array<
  AppearanceOption<AirportCircleRadiusMode>
> = [
  { value: 'byFrequency', label: 'By frequency' },
  { value: 'uniform', label: 'Uniform' },
];

export const ARC_COLOR_OPTIONS: Array<AppearanceOption<ArcColorMode>> = [
  { value: 'default', label: 'Default' },
  { value: 'byFrequency', label: 'By frequency' },
];

export const ARC_THICKNESS_OPTIONS: Array<AppearanceOption<ArcThicknessMode>> =
  [
    { value: 'uniform', label: 'Uniform' },
    { value: 'byFrequency', label: 'By frequency' },
  ];

export const ARC_SCALE_OPTIONS: Array<AppearanceOption<ArcThicknessScale>> = [
  { value: 'thin', label: 'Thin' },
  { value: 'normal', label: 'Normal' },
  { value: 'thick', label: 'Thick' },
];

export const ROUTE_DISPLAY_OPTIONS: Array<AppearanceOption<RouteDisplayMode>> =
  [
    { value: 'tracks', label: 'Flight tracks' },
    { value: 'points', label: 'Point to point' },
  ];

export const AIRPORT_DETAIL_OPTIONS: Array<
  AppearanceOption<AirportOverlayDetail>
> = [
  { value: 'standard', label: 'Standard' },
  { value: 'detailed', label: 'Detailed' },
];

export const OPENAIP_GROUP_OPTIONS: Array<
  AppearanceOption<OpenAipOverlayGroup>
> = [
  { value: 'airspaces', label: 'Airspaces' },
  { value: 'airspaceLabels', label: 'Airspace labels' },
  { value: 'airports', label: 'Airports' },
  { value: 'navaids', label: 'Navaids' },
  { value: 'reportingPoints', label: 'Reporting points' },
];

export const BASEMAP_OPTIONS: Array<AppearanceOption<MapBasemap>> = [
  { value: 'default', label: 'Default' },
  { value: 'satellite', label: 'Satellite' },
];

export const PROJECTION_OPTIONS: Array<AppearanceOption<MapProjection>> = [
  { value: 'mercator', label: 'Flat' },
  { value: 'globe', label: 'Globe' },
];

OPENAIP_OVERLAY_GROUPS satisfies readonly OpenAipOverlayGroup[];
