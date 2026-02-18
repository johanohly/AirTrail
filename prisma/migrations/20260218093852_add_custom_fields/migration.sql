-- Create custom field definitions
CREATE TABLE "custom_field_definition" (
  "id" SERIAL PRIMARY KEY,
  "entity_type" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "field_type" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "order" INTEGER NOT NULL DEFAULT 0,
  "default_value" JSONB,
  "options" JSONB,
  "validation_json" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "custom_field_definition_entity_type_key_key" UNIQUE ("entity_type", "key")
);

CREATE INDEX "custom_field_definition_entity_type_active_order_idx"
  ON "custom_field_definition" ("entity_type", "active", "order");

-- Create custom field values
CREATE TABLE "custom_field_value" (
  "id" SERIAL PRIMARY KEY,
  "field_id" INTEGER NOT NULL REFERENCES "custom_field_definition"("id") ON DELETE CASCADE,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "custom_field_value_field_id_entity_type_entity_id_key" UNIQUE ("field_id", "entity_type", "entity_id")
);

CREATE INDEX "custom_field_value_entity_type_entity_id_idx"
  ON "custom_field_value" ("entity_type", "entity_id");
