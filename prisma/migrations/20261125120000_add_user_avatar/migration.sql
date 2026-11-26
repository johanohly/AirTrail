-- AlterTable
ALTER TABLE "public"."user" ADD COLUMN "avatar_hash" TEXT,
ADD COLUMN "avatar_source" TEXT;

-- CreateTable
CREATE TABLE "public"."user_avatar" (
    "user_id" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_avatar_pkey" PRIMARY KEY ("user_id")
);

-- AddForeignKey
ALTER TABLE "public"."user_avatar" ADD CONSTRAINT "user_avatar_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
