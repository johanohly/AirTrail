ALTER TABLE "user" ADD COLUMN "custom_flight_reasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
