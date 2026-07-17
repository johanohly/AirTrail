-- AlterTable
ALTER TABLE "flight" ADD COLUMN     "arrival_runway_id" INTEGER,
ADD COLUMN     "departure_runway_id" INTEGER;

-- CreateTable
CREATE TABLE "runway" (
    "id" SERIAL NOT NULL,
    "source_id" INTEGER NOT NULL,
    "airport_id" INTEGER NOT NULL,
    "length" INTEGER,
    "width" INTEGER,
    "surface" TEXT,
    "lighted" BOOLEAN NOT NULL DEFAULT false,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "le_ident" TEXT,
    "le_lat" DOUBLE PRECISION,
    "le_lon" DOUBLE PRECISION,
    "le_ele" INTEGER,
    "le_hdg" DOUBLE PRECISION,
    "le_disp_threshold" DOUBLE PRECISION,
    "he_ident" TEXT,
    "he_lat" DOUBLE PRECISION,
    "he_lon" DOUBLE PRECISION,
    "he_ele" INTEGER,
    "he_hdg" DOUBLE PRECISION,
    "he_disp_threshold" DOUBLE PRECISION,

    CONSTRAINT "runway_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "runway_source_id_key" ON "runway"("source_id");

-- CreateIndex
CREATE INDEX "runway_airport_id_idx" ON "runway"("airport_id");

-- CreateIndex
CREATE INDEX "flight_departure_runway_id_idx" ON "flight"("departure_runway_id");

-- CreateIndex
CREATE INDEX "flight_arrival_runway_id_idx" ON "flight"("arrival_runway_id");

-- AddForeignKey
ALTER TABLE "runway" ADD CONSTRAINT "runway_airport_id_fkey" FOREIGN KEY ("airport_id") REFERENCES "airport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flight" ADD CONSTRAINT "flight_departure_runway_id_fkey" FOREIGN KEY ("departure_runway_id") REFERENCES "runway"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flight" ADD CONSTRAINT "flight_arrival_runway_id_fkey" FOREIGN KEY ("arrival_runway_id") REFERENCES "runway"("id") ON DELETE SET NULL ON UPDATE CASCADE;

