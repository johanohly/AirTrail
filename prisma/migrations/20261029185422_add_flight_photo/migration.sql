-- CreateTable
CREATE TABLE "flight_photo" (
    "flight_id" INTEGER NOT NULL,
    "reg" TEXT NOT NULL,
    "photo_link" TEXT NOT NULL,
    "thumbnail_url" TEXT NOT NULL,
    "photographer" TEXT NOT NULL,
    "fetched_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flight_photo_pkey" PRIMARY KEY ("flight_id")
);

-- AddForeignKey
ALTER TABLE "flight_photo" ADD CONSTRAINT "flight_photo_flight_id_fkey" FOREIGN KEY ("flight_id") REFERENCES "flight"("id") ON DELETE CASCADE ON UPDATE CASCADE;
