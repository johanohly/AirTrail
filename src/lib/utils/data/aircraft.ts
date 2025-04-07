import { toTitleCase } from '../string';

import { AIRCRAFT } from '$lib/data/aircraft';

const labelCache = new Map<string, string | null>();

export type Aircraft = (typeof AIRCRAFT)[number];

export const WTC_TO_LABEL = {
  L: 'Light',
  M: 'Medium',
  H: 'Heavy',
  J: 'Super',
};

export const aircraftFromICAO = (icao: string): Aircraft | null => {
  return AIRCRAFT.find((aircraft) => aircraft.icao === icao) ?? null;
};

export const getAircraftLabel = (icao: string): string | null => {
  if (labelCache.has(icao)) return labelCache.get(icao)!;

  const aircraft = aircraftFromICAO(icao);
  if (!aircraft || !aircraft.name) {
    labelCache.set(icao, null);
    return null;
  }
  const parts = aircraft.name.split(' ');
  const manufacturer = parts[0]!;
  const model = parts[1]!;
  const label = `${toTitleCase(manufacturer)} ${toTitleCase(model)}`;
  labelCache.set(icao, label);
  return label;
};
