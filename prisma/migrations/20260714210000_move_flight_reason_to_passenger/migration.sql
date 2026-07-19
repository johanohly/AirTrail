-- AddColumn
ALTER TABLE "flight_passenger" ADD COLUMN "flight_reason" TEXT;

-- Preserve the existing shared reason for every passenger on the flight.
UPDATE "flight_passenger" AS passenger
SET "flight_reason" = flight."flight_reason"
FROM "flight"
WHERE passenger."flight_id" = flight."id";

-- DropColumn
ALTER TABLE "flight" DROP COLUMN "flight_reason";
