-- Custom field values use polymorphic entity IDs, so database foreign keys
-- cannot clean them up when their owning flight or passenger is deleted.
CREATE OR REPLACE FUNCTION cleanup_custom_field_values_for_entity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'flight' THEN
    DELETE FROM "custom_field_value"
    WHERE "entity_type" = 'flight'
      AND "entity_id" = OLD."id"::text;
  ELSIF TG_TABLE_NAME = 'flight_passenger' THEN
    DELETE FROM "custom_field_value"
    WHERE "entity_type" = 'flight_passenger'
      AND "entity_id" = OLD."id"::text;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "flight_custom_field_value_cleanup"
AFTER DELETE ON "flight"
FOR EACH ROW EXECUTE FUNCTION cleanup_custom_field_values_for_entity();

CREATE TRIGGER "flight_passenger_custom_field_value_cleanup"
AFTER DELETE ON "flight_passenger"
FOR EACH ROW EXECUTE FUNCTION cleanup_custom_field_values_for_entity();
