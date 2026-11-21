-- Airport imports now place Cyprus in Europe (see `CONTINENT_OVERRIDES` in
-- src/lib/utils/data/airports/source.ts), but rows imported before that keep
-- OurAirports' Asia until an admin runs Update airports. Custom airports keep
-- the continent their creator picked.
UPDATE "airport"
SET "continent" = 'EU'
WHERE "country" = 'CY' AND "continent" = 'AS' AND "custom" = false;
