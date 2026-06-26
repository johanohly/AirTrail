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
CREATE INDEX "oauth_link_token_user_id_idx" ON "oauth_link_token"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_oauth_id_key" ON "user"("oauth_id");

-- AddForeignKey
ALTER TABLE "oauth_link_token" ADD CONSTRAINT "oauth_link_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
