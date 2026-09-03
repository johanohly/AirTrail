ALTER TABLE "api_key"
  ADD COLUMN "scopes" TEXT[] NOT NULL DEFAULT ARRAY[
    'profile.read', 'preferences.write', 'flight.read.own', 'flight.read.any',
    'flight.create.own', 'flight.create.any', 'flight.update.own',
    'flight.update.any', 'flight.delete.own', 'flight.delete.any',
    'flight.export.own', 'flight.export.any', 'flight.passengers.manage.own',
    'flight.passengers.manage.any', 'flight.share.own', 'users.directory.read',
    'users.create', 'users.update', 'users.delete', 'users.roles.assign',
    'data.airports.manage', 'data.airlines.manage', 'data.aircraft.manage',
    'custom_fields.manage', 'roles.manage', 'reference_data.read', 'stats.read',
    'tracks.read', 'tracks.write', 'visited_countries.read',
    'visited_countries.write', 'shares.read', 'shares.write', 'weather.read'
  ]::TEXT[];

CREATE TABLE "oauth_client" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "client_secret_hash" TEXT,
  "token_endpoint_auth_method" TEXT NOT NULL DEFAULT 'none',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "oauth_client_auth_method_check"
    CHECK ("token_endpoint_auth_method" IN ('none', 'client_secret_post'))
);

CREATE TABLE "oauth_client_redirect_uri" (
  "client_id" TEXT NOT NULL REFERENCES "oauth_client"("id") ON DELETE CASCADE,
  "redirect_uri" TEXT NOT NULL,
  PRIMARY KEY ("client_id", "redirect_uri")
);

CREATE TABLE "oauth_authorization_request" (
  "id" TEXT PRIMARY KEY,
  "client_id" TEXT NOT NULL REFERENCES "oauth_client"("id") ON DELETE CASCADE,
  "user_id" TEXT REFERENCES "user"("id") ON DELETE CASCADE,
  "redirect_uri" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL,
  "resource" TEXT NOT NULL,
  "state" TEXT,
  "code_challenge" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "oauth_authorization_request_expires_at_idx"
  ON "oauth_authorization_request"("expires_at");

CREATE TABLE "oauth_grant" (
  "id" TEXT PRIMARY KEY,
  "client_id" TEXT NOT NULL REFERENCES "oauth_client"("id") ON DELETE CASCADE,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "resource" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("client_id", "user_id", "resource")
);

CREATE TABLE "oauth_authorization_code" (
  "code_hash" TEXT PRIMARY KEY,
  "client_id" TEXT NOT NULL REFERENCES "oauth_client"("id") ON DELETE CASCADE,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "grant_id" TEXT NOT NULL REFERENCES "oauth_grant"("id") ON DELETE CASCADE,
  "redirect_uri" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL,
  "resource" TEXT NOT NULL,
  "code_challenge" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "used_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "oauth_authorization_code_expires_at_idx"
  ON "oauth_authorization_code"("expires_at");

CREATE TABLE "oauth_access_token" (
  "token_hash" TEXT PRIMARY KEY,
  "client_id" TEXT NOT NULL REFERENCES "oauth_client"("id") ON DELETE CASCADE,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "grant_id" TEXT NOT NULL REFERENCES "oauth_grant"("id") ON DELETE CASCADE,
  "refresh_family_id" TEXT,
  "scopes" TEXT[] NOT NULL,
  "resource" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "revoked_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "oauth_access_token_expires_at_idx" ON "oauth_access_token"("expires_at");
CREATE INDEX "oauth_access_token_refresh_family_id_idx" ON "oauth_access_token"("refresh_family_id");

CREATE TABLE "oauth_refresh_token" (
  "token_hash" TEXT PRIMARY KEY,
  "client_id" TEXT NOT NULL REFERENCES "oauth_client"("id") ON DELETE CASCADE,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "grant_id" TEXT NOT NULL REFERENCES "oauth_grant"("id") ON DELETE CASCADE,
  "family_id" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL,
  "resource" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "used_at" TIMESTAMPTZ,
  "revoked_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "oauth_refresh_token_family_id_idx" ON "oauth_refresh_token"("family_id");
CREATE INDEX "oauth_refresh_token_expires_at_idx" ON "oauth_refresh_token"("expires_at");
