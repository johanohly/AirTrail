CREATE TABLE "seat"
(
    "id"          SERIAL  NOT NULL,
    "flight_id"   INTEGER NOT NULL,
    "user_id"     TEXT,
    "guest_name"  TEXT,
    "seat"        TEXT,
    "seat_number" TEXT,
    "seat_class"  TEXT,

    CONSTRAINT "seat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX seat_user_id_flight_id_key
    ON "seat" ("flight_id", "user_id");

CREATE UNIQUE INDEX seat_flight_id_guest_name_key
    ON "seat" ("flight_id", "guest_name");

ALTER TABLE "seat"
    ADD CONSTRAINT "seat_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "seat"
    ADD CONSTRAINT "seat_flight_id_fkey" FOREIGN KEY ("flight_id") REFERENCES "flight" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing data from flight table to seat table
INSERT INTO "seat" ("user_id", "flight_id", "seat", "seat_number", "seat_class")
SELECT "user_id", "id", "seat", "seat_number", "seat_class"
FROM "flight"
WHERE "user_id" IS NOT NULL;

-- Drop the old columns from the flight table
ALTER TABLE "flight"
    DROP COLUMN "seat",
    DROP COLUMN "seat_class",
    DROP COLUMN "seat_number",
    DROP COLUMN "user_id";
