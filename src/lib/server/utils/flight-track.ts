import { db } from '$lib/db';
import {
  getFlightTrackRowPrimitive,
  listFlightTrackRowsPrimitive,
} from '$lib/db/queries';
import { reduceFlightTrackForMap } from '$lib/track/render';
import {
  flightTrackPayloadSchema,
  type FlightTrackRow,
  type FlightTrackSourceFormat,
} from '$lib/track/schema';

type FlightTrackRowSource = {
  flightId: number;
  track: unknown;
  sourceFormat: FlightTrackSourceFormat;
  sourceName: string | null;
  pointCount: number;
};

const parseTrackRow = (
  row: FlightTrackRowSource,
  reduceForMap = false,
): FlightTrackRow => {
  const track = flightTrackPayloadSchema.parse(row.track);
  return {
    flightId: row.flightId,
    ...(reduceForMap ? reduceFlightTrackForMap(track) : track),
    sourceFormat: row.sourceFormat,
    sourceName: row.sourceName,
    pointCount: row.pointCount,
  };
};

export const getFlightTrack = async (
  flightId: number,
  { reduceForMap = false }: { reduceForMap?: boolean } = {},
): Promise<FlightTrackRow | null> => {
  const row = await getFlightTrackRowPrimitive(db, flightId);
  return row ? parseTrackRow(row, reduceForMap) : null;
};

export const listFlightTracks = async (
  userId: string,
  { reduceForMap = false }: { reduceForMap?: boolean } = {},
): Promise<FlightTrackRow[]> => {
  const rows = await listFlightTrackRowsPrimitive(db, userId);
  return rows.map((row) => parseTrackRow(row, reduceForMap));
};

export const listAllFlightTracks = async (
  { reduceForMap = false }: { reduceForMap?: boolean } = {},
): Promise<FlightTrackRow[]> => {
  const rows = await listFlightTrackRowsPrimitive(db);
  return rows.map((row) => parseTrackRow(row, reduceForMap));
};
