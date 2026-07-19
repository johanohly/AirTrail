import type { Aircraft, Airline, Airport, CreateFlight } from '$lib/db/types';

export type UnknownImportValues = Record<string, number[]>;

export type ImportMappings = {
  airports: Record<string, Airport>;
  airlines: Record<string, Airline>;
  aircraft: Record<string, Aircraft>;
};

export type ImportUnknowns = {
  airports: UnknownImportValues;
  airlines: UnknownImportValues;
  aircraft: UnknownImportValues;
};

export type ExportedImportUser = {
  id: string;
  username: string;
  displayName: string;
  mappedUserId: string | null;
};

export type ProcessResult = {
  flights: CreateFlight[];
  unknowns: ImportUnknowns;
  exportedUsers: ExportedImportUser[];
  skippedRows?: number;
};

export type PlatformOptions = {
  filterOwner: boolean;
  airlineFromFlightNumber: boolean;
  importMode: 'personal' | 'restore';
  airportMapping?: ImportMappings['airports'];
  airlineMapping?: ImportMappings['airlines'];
  aircraftMapping?: ImportMappings['aircraft'];
  userMapping?: Record<string, string>;
};

export type IndexedFlight = {
  flight: CreateFlight;
  index: number;
};

export const createEmptyImportMappings = (): ImportMappings => ({
  airports: {},
  airlines: {},
  aircraft: {},
});

export const createEmptyImportUnknowns = (): ImportUnknowns => ({
  airports: {},
  airlines: {},
  aircraft: {},
});

export const mergeImportMappings = (
  current: ImportMappings,
  pending: ImportMappings,
): ImportMappings => ({
  airports: { ...current.airports, ...pending.airports },
  airlines: { ...current.airlines, ...pending.airlines },
  aircraft: { ...current.aircraft, ...pending.aircraft },
});
