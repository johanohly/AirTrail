import { Tooltip } from 'bits-ui';

export type TimeDisplayMode = 'flight' | 'plain';

export type TimeDisplaySide = 'top' | 'right' | 'bottom' | 'left';

export type TimeDisplayPayload = {
  date: Date;
  /** The actual instant, when the caller has one; null for plain displays. */
  actualDate: Date | null;
  /** The scheduled instant, when the caller has one; null for plain displays. */
  scheduledDate: Date | null;
  airportTz: string | null;
  airportLabel: string | null;
  mode: TimeDisplayMode;
  side: TimeDisplaySide;
  headline: string | null;
  headlineStatus: 'early' | 'late' | null;
  note: string | null;
  zIndex: number | undefined;
};

export const timeDisplayTether = Tooltip.createTether<TimeDisplayPayload>();
