-- AlterTable
ALTER TABLE "user"
    ADD COLUMN "oauth_id" TEXT,
    ALTER COLUMN "password" DROP NOT NULL;

-- CreateTable
CREATE TABLE "app_config"
(
    "id"            SERIAL  NOT NULL,
    "enabled"       BOOLEAN NOT NULL DEFAULT false,
    "issuer_url"    TEXT,
    "client_id"     TEXT,
    "client_secret" TEXT,
    "scope"         TEXT    NOT NULL DEFAULT 'openid profile',
    "auto_register" BOOLEAN NOT NULL DEFAULT true,
    "auto_login"    BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "app_config_pkey" PRIMARY KEY ("id")
);

-- Insert
INSERT INTO "app_config" ("enabled", "scope", "auto_register",
                          "auto_login")
VALUES (false, 'openid profile', true,
        false);

