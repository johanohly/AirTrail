CREATE TABLE "flight_track" (
    "flight_id" INTEGER NOT NULL,
    "track" JSONB NOT NULL,
    "source_format" TEXT NOT NULL,
    "source_name" TEXT,
    "point_count" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flight_track_pkey" PRIMARY KEY ("flight_id")
);

ALTER TABLE "flight_track" ADD CONSTRAINT "flight_track_flight_id_fkey" FOREIGN KEY ("flight_id") REFERENCES "flight"("id") ON DELETE CASCADE ON UPDATE CASCADE;
