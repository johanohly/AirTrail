-- CreateTable
CREATE TABLE "custom_field_definition" (
    "id" SERIAL NOT NULL,
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
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "custom_field_definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_value" (
    "id" SERIAL NOT NULL,
    "field_id" INTEGER NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "custom_field_value_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custom_field_definition_entity_type_active_order_idx" ON "custom_field_definition"("entity_type", "active", "order");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_definition_entity_type_key_key" ON "custom_field_definition"("entity_type", "key");

-- CreateIndex
CREATE INDEX "custom_field_value_entity_type_entity_id_idx" ON "custom_field_value"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_value_field_id_entity_type_entity_id_key" ON "custom_field_value"("field_id", "entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "custom_field_value" ADD CONSTRAINT "custom_field_value_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "custom_field_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
