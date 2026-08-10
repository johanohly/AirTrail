-- AddColumn
ALTER TABLE "flight_passenger" ADD COLUMN "flight_reason" TEXT;

-- Flights must have at least one passenger. Clean up legacy orphan rows before
-- moving passenger-owned data, including polymorphic custom field values that
-- cannot be removed by a foreign key.
DELETE FROM "custom_field_value"
WHERE "entity_type" = 'flight'
  AND "entity_id" IN (
    SELECT flight."id"::text
    FROM "flight" AS flight
    WHERE NOT EXISTS (
      SELECT 1
      FROM "flight_passenger" AS passenger
      WHERE passenger."flight_id" = flight."id"
    )
  );

DELETE FROM "flight" AS flight
WHERE NOT EXISTS (
  SELECT 1
  FROM "flight_passenger" AS passenger
  WHERE passenger."flight_id" = flight."id"
);

-- Preserve the existing shared reason for every passenger on the flight.
UPDATE "flight_passenger" AS passenger
SET "flight_reason" = flight."flight_reason"
FROM "flight"
WHERE passenger."flight_id" = flight."id";

-- DropColumn
ALTER TABLE "flight" DROP COLUMN "flight_reason";
