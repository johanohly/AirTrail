-- CreateTable
CREATE TABLE "public"."public_share" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "show_map" BOOLEAN NOT NULL DEFAULT true,
    "show_stats" BOOLEAN NOT NULL DEFAULT false,
    "show_flight_list" BOOLEAN NOT NULL DEFAULT false,
    "date_from" TEXT,
    "date_to" TEXT,
    "show_flight_numbers" BOOLEAN NOT NULL DEFAULT true,
    "show_airlines" BOOLEAN NOT NULL DEFAULT true,
    "show_aircraft" BOOLEAN NOT NULL DEFAULT false,
    "show_times" BOOLEAN NOT NULL DEFAULT false,
    "show_dates" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "public_share_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "public_share_slug_key" ON "public"."public_share"("slug");

-- CreateIndex
CREATE INDEX "public_share_slug_idx" ON "public"."public_share"("slug");

-- CreateIndex
CREATE INDEX "public_share_user_id_idx" ON "public"."public_share"("user_id");

-- AddForeignKey
ALTER TABLE "public"."public_share" ADD CONSTRAINT "public_share_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
