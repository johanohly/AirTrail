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

export type PendingFlightOptions = {
  allowUnknownAirlines?: boolean;
  allowUnknownAircraft?: boolean;
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
export const getPendingFlights = (
  flights: CreateFlight[],
  unknowns: ImportUnknowns,
  handledIndices: ReadonlySet<number>,
  options: PendingFlightOptions = {},
): IndexedFlight[] => {
  const unknownIndices = new Set([
    ...Object.values(unknowns.airports).flat(),
    ...(options.allowUnknownAirlines
      ? []
      : Object.values(unknowns.airlines).flat()),
    ...(options.allowUnknownAircraft
      ? []
      : Object.values(unknowns.aircraft).flat()),
  ]);

  return flights
    .map((flight, index) => ({ flight, index }))
    .filter(
      ({ index }) => !unknownIndices.has(index) && !handledIndices.has(index),
    );
};

export const getOutstandingUnknowns = (
  unknowns: ImportUnknowns,
  handledIndices: ReadonlySet<number>,
): ImportUnknowns => {
  const filterHandledIndices = (values: UnknownImportValues) => {
    const outstanding: UnknownImportValues = {};
    for (const [code, indices] of Object.entries(values)) {
      const remaining = indices.filter((index) => !handledIndices.has(index));
      if (remaining.length) outstanding[code] = remaining;
    }
    return outstanding;
  };

  return {
    airports: filterHandledIndices(unknowns.airports),
    airlines: filterHandledIndices(unknowns.airlines),
    aircraft: filterHandledIndices(unknowns.aircraft),
  };
};
