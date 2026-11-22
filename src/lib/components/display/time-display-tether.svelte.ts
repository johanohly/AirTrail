import { Tooltip } from '$lib/primitives';

export type TimeDisplayMode = 'flight' | 'plain';

export type TimeDisplaySide = 'top' | 'right' | 'bottom' | 'left';

export type TimeDisplayPayload = {
  date: Date;
  airportTz: string | null;
  airportLabel: string | null;
  mode: TimeDisplayMode;
  side: TimeDisplaySide;
  headline: string | null;
  headlineStatus: 'early' | 'late' | null;
  note: string | null;
  noteZone: string | null;
  zIndex: number | undefined;
};

export const timeDisplayTether = Tooltip.createTether<TimeDisplayPayload>();
