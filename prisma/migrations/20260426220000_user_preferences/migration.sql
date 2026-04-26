-- AlterTable: add granular display preference columns.
ALTER TABLE "user"
  ADD COLUMN "distance_unit"       TEXT NOT NULL DEFAULT 'km',
  ADD COLUMN "wind_speed_unit"     TEXT NOT NULL DEFAULT 'kt',
  ADD COLUMN "temperature_unit"    TEXT NOT NULL DEFAULT 'c',
  ADD COLUMN "pressure_unit"       TEXT NOT NULL DEFAULT 'hpa',
  ADD COLUMN "time_format"         TEXT NOT NULL DEFAULT 'auto',
  ADD COLUMN "date_format"         TEXT NOT NULL DEFAULT 'auto',
  ADD COLUMN "week_starts_on"      TEXT NOT NULL DEFAULT 'auto',
  ADD COLUMN "flight_time_display" TEXT NOT NULL DEFAULT 'airport';

-- Backfill from the legacy single-axis "unit" column. Wind speed stays at the
-- aviation-standard 'kt' default for everyone since knots is universal in METAR.
UPDATE "user"
SET
  "distance_unit"    = CASE WHEN "unit" = 'imperial' THEN 'mi'   ELSE 'km'  END,
  "temperature_unit" = CASE WHEN "unit" = 'imperial' THEN 'f'    ELSE 'c'   END,
  "pressure_unit"    = CASE WHEN "unit" = 'imperial' THEN 'inhg' ELSE 'hpa' END;

-- Drop the legacy column.
ALTER TABLE "user" DROP COLUMN "unit";
