-- Null until a flight is moved; the order falls back to `id`.
ALTER TABLE "public"."flight" ADD COLUMN "sort_key" DOUBLE PRECISION;
