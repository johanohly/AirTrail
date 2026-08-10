-- CreateTable
CREATE TABLE "oauth_link_token" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "oauth_sub" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_link_token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "oauth_link_token_token_key" ON "oauth_link_token"("token");

-- CreateIndex
CREATE INDEX "oauth_link_token_token_idx" ON "oauth_link_token"("token");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_link_token_user_id_key" ON "oauth_link_token"("user_id");

-- Deduplicate existing OAuth links before enforcing one user per OAuth subject.
WITH ranked_oauth_users AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (PARTITION BY "oauth_id" ORDER BY "id") AS "rank"
    FROM "user"
    WHERE "oauth_id" IS NOT NULL
)
UPDATE "user"
SET "oauth_id" = NULL
FROM ranked_oauth_users
WHERE "user"."id" = ranked_oauth_users."id"
  AND ranked_oauth_users."rank" > 1;

-- CreateIndex
CREATE UNIQUE INDEX "user_oauth_id_key" ON "user"("oauth_id");

-- AddForeignKey
ALTER TABLE "oauth_link_token" ADD CONSTRAINT "oauth_link_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
