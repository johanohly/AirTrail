-- CreateTable
CREATE TABLE "calendar_feed" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "reminder_offset_minutes" INTEGER,
    "show_emoji" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_fetched" TIMESTAMPTZ,

    CONSTRAINT "calendar_feed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "calendar_feed_user_id_key" ON "calendar_feed"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_feed_token_key" ON "calendar_feed"("token");

-- CreateIndex
CREATE INDEX "calendar_feed_token_idx" ON "calendar_feed"("token");

-- AddForeignKey
ALTER TABLE "calendar_feed" ADD CONSTRAINT "calendar_feed_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
