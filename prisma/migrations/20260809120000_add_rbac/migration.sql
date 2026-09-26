CREATE TABLE "access_role" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "access_role_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "access_role_name_ci_key" ON "access_role" (LOWER("name"));

CREATE TABLE "access_role_permission" (
  "role_id" TEXT NOT NULL,
  "permission" TEXT NOT NULL,
  CONSTRAINT "access_role_permission_pkey" PRIMARY KEY ("role_id", "permission"),
  CONSTRAINT "access_role_permission_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "access_role"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "authorization_settings" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "default_role_id" TEXT NOT NULL,
  "oauth_role_mapping_mode" TEXT NOT NULL DEFAULT 'off',
  CONSTRAINT "authorization_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "authorization_settings_singleton_check" CHECK ("id" = 1),
  CONSTRAINT "authorization_settings_oauth_role_mapping_mode_check"
    CHECK ("oauth_role_mapping_mode" IN ('off', 'on_create', 'on_login')),
  CONSTRAINT "authorization_settings_default_role_id_key" UNIQUE ("default_role_id"),
  CONSTRAINT "authorization_settings_default_role_id_fkey"
    FOREIGN KEY ("default_role_id") REFERENCES "access_role"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "oauth_role_mapping" (
  "id" SERIAL NOT NULL,
  "priority" INTEGER NOT NULL,
  "name" TEXT NOT NULL DEFAULT '',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "claim_source" TEXT NOT NULL,
  "claim_path" TEXT NOT NULL,
  "operator" TEXT NOT NULL,
  "claim_value" TEXT NOT NULL,
  "role_id" TEXT NOT NULL,
  CONSTRAINT "oauth_role_mapping_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "oauth_role_mapping_claim_source_check"
    CHECK ("claim_source" IN ('userinfo', 'id_token')),
  CONSTRAINT "oauth_role_mapping_operator_check"
    CHECK ("operator" IN ('equals', 'contains')),
  CONSTRAINT "oauth_role_mapping_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "access_role"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "oauth_role_mapping_priority_idx" ON "oauth_role_mapping"("priority");

ALTER TABLE "user"
  ADD COLUMN "role_id" TEXT,
  ADD COLUMN "is_owner" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "role_assignment_source" TEXT NOT NULL DEFAULT 'local';

INSERT INTO "access_role" ("id", "name", "description") VALUES
  ('role-user', 'User', 'Manage personal flights and account data.'),
  ('role-administrator', 'Administrator', 'Manage users, flights, reference data, and instance settings.');

INSERT INTO "access_role_permission" ("role_id", "permission") VALUES
  ('role-user', 'flight.read.own'),
  ('role-user', 'flight.create.own'),
  ('role-user', 'flight.update.own'),
  ('role-user', 'flight.delete.own'),
  ('role-user', 'flight.import.own'),
  ('role-user', 'flight.export.own'),
  ('role-user', 'flight.passengers.manage.own'),
  ('role-user', 'flight.share.own'),
  ('role-user', 'users.directory.read'),
  ('role-administrator', 'flight.read.any'),
  ('role-administrator', 'flight.create.any'),
  ('role-administrator', 'flight.update.any'),
  ('role-administrator', 'flight.delete.any'),
  ('role-administrator', 'flight.import.any'),
  ('role-administrator', 'flight.export.any'),
  ('role-administrator', 'flight.passengers.manage.any'),
  ('role-administrator', 'flight.share.own'),
  ('role-administrator', 'users.directory.read'),
  ('role-administrator', 'users.create'),
  ('role-administrator', 'users.update'),
  ('role-administrator', 'users.delete'),
  ('role-administrator', 'users.roles.assign'),
  ('role-administrator', 'data.airports.manage'),
  ('role-administrator', 'data.aircraft.manage'),
  ('role-administrator', 'data.airlines.manage'),
  ('role-administrator', 'custom_fields.manage'),
  ('role-administrator', 'instance.oauth.manage'),
  ('role-administrator', 'instance.integrations.manage'),
  ('role-administrator', 'instance.map.manage'),
  ('role-administrator', 'instance.release.check');

-- Very old installs could create more than one legacy owner. Preserve one
-- deterministic protected owner and migrate the remainder to Administrator.
UPDATE "user" SET "role_id" = 'role-administrator' WHERE "role" = 'owner';
UPDATE "user"
SET "is_owner" = true, "role_id" = NULL
WHERE "id" = (
  SELECT "id" FROM "user" WHERE "role" = 'owner' ORDER BY "id" LIMIT 1
);
UPDATE "user" SET "role_id" = 'role-administrator' WHERE "role" = 'admin';
UPDATE "user" SET "role_id" = 'role-user' WHERE "role" = 'user';

ALTER TABLE "user"
  ADD CONSTRAINT "user_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "access_role"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "user_owner_role_check"
    CHECK (("is_owner" AND "role_id" IS NULL) OR (NOT "is_owner" AND "role_id" IS NOT NULL)),
  ADD CONSTRAINT "user_role_assignment_source_check"
    CHECK ("role_assignment_source" IN ('local', 'oauth'));

CREATE UNIQUE INDEX "user_single_owner_key" ON "user" ("is_owner") WHERE "is_owner";

ALTER TABLE "user" DROP COLUMN "role";

INSERT INTO "authorization_settings" ("id", "default_role_id")
VALUES (1, 'role-user');
