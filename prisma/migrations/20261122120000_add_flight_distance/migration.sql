ALTER TABLE "public"."flight" ADD COLUMN "manual_distance" DOUBLE PRECISION;

-- Existing tracks are measured after startup, see `backfillTrackDistances`.
ALTER TABLE "public"."flight_track" ADD COLUMN "distance" DOUBLE PRECISION;
