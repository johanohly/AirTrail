import { Tooltip } from 'bits-ui';

export type TimeDisplayMode = 'flight' | 'plain';

export type TimeDisplaySide = 'top' | 'right' | 'bottom' | 'left';

export type TimeDisplayPayload = {
  date: Date;
  airportTz: string | null;
  airportLabel: string | null;
  mode: TimeDisplayMode;
  side: TimeDisplaySide;
  zIndex: number | undefined;
};

export const timeDisplayTether = Tooltip.createTether<TimeDisplayPayload>();
