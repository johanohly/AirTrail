import { AIRCRAFT } from '$lib/data/aircraft';

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
