-- AlterTable
ALTER TABLE "flight" ADD COLUMN "departure_scheduled" TEXT;
ALTER TABLE "flight" ADD COLUMN "arrival_scheduled" TEXT;
ALTER TABLE "flight" ADD COLUMN "takeoff_scheduled" TEXT;
ALTER TABLE "flight" ADD COLUMN "takeoff_actual" TEXT;
ALTER TABLE "flight" ADD COLUMN "landing_scheduled" TEXT;
ALTER TABLE "flight" ADD COLUMN "landing_actual" TEXT;
