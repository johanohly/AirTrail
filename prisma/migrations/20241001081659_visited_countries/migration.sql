-- CreateTable
CREATE TABLE "visited_country" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "visited_country_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "visited_country_code_user_id_key" ON "visited_country"("code", "user_id");

-- AddForeignKey
ALTER TABLE "visited_country" ADD CONSTRAINT "visited_country_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
