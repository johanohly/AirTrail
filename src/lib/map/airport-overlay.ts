export const AIRPORT_OVERLAY_PMTILES_PATH = '/airport-overlay.pmtiles';
export const AIRPORT_OVERLAY_SOURCE_ID = 'airport-overlay';
export const AIRPORT_OVERLAY_MAXZOOM = 14;
export const AIRPORT_OVERLAY_CENTER: [number, number] = [12.6458, 55.6181];
export const AIRPORT_OVERLAY_DEFAULT_ZOOM = 15;

export const AIRPORT_OVERLAY_SOURCE_LAYERS = {
  airport: 'airport',
  airportLabels: 'airport_labels',
  airportNodes: 'airport_nodes',
  aerodrome: 'aerodrome',
} as const;

export const AIRPORT_FEATURE_KINDS = [
  'runway',
  'taxiway',
  'apron',
  'terminal',
  'jet_bridge',
] as const;

export const AIRPORT_LABEL_TYPES = [
  'gate',
  'terminal',
  'taxiway',
  'runway',
] as const;

export type AirportOverlaySourceLayer =
  (typeof AIRPORT_OVERLAY_SOURCE_LAYERS)[keyof typeof AIRPORT_OVERLAY_SOURCE_LAYERS];

export type AirportFeatureKind = (typeof AIRPORT_FEATURE_KINDS)[number];
export type AirportLabelType = (typeof AIRPORT_LABEL_TYPES)[number];

export type AirportFeatureProperties = {
  kind: AirportFeatureKind;
  aeroway: AirportFeatureKind;
  ref?: string;
  name?: string;
  'name:en'?: string;
  iata?: string;
  icao?: string;
  surface?: string;
  width_m?: number;
  length_m?: number;
  terminal?: string;
  gate?: string;
  osm_id?: string;
};

export type AirportLabelProperties = {
  type: AirportLabelType;
  name?: string;
  'name:en'?: string;
  ref?: string;
  iata?: string;
  icao?: string;
  terminal?: string;
  gate?: string;
  rank?: number;
  osm_id?: string;
};

export type AirportNodeProperties = {
  class: 'aerodrome';
  name: string;
  label_name?: string;
  'name:en'?: string;
  iata?: string;
  icao?: string;
  rank?: number;
  osm_id?: string;
};

export type AerodromeProperties = {
  class: 'aerodrome';
  name?: string;
  label_name?: string;
  'name:en'?: string;
  iata?: string;
  icao?: string;
  area_rank?: number;
  osm_id?: string;
};
