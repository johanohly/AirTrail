ALTER TABLE "aircraft"
  ADD COLUMN "specific" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "type_id" INTEGER,
  ADD COLUMN "serial_number" TEXT,
  ADD COLUMN "first_flight" TEXT;

ALTER TABLE "aircraft"
  ADD CONSTRAINT "aircraft_type_id_fkey" FOREIGN KEY ("type_id")
  REFERENCES "aircraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "aircraft_type_id_idx" ON "aircraft"("type_id");
