import { trpc } from './index';

export const invalidateFlightData = async () => {
  await Promise.all([
    trpc.flight.list.utils.invalidate(),
    trpc.flight.guests.utils.invalidate(),
    trpc.flightTrack.list.utils.invalidate(),
  ]);
};
