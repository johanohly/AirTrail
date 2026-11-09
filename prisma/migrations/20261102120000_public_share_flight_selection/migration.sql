ALTER TABLE "public"."public_share" ADD COLUMN "flight_selection" TEXT NOT NULL DEFAULT 'all';

-- Existing date-filtered shares become the equivalent explicit mode
UPDATE "public"."public_share" SET "flight_selection" = 'custom' WHERE "date_from" IS NOT NULL OR "date_to" IS NOT NULL;
