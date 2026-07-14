-- AlterTable
ALTER TABLE "seat" ADD COLUMN "seat_extras" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
