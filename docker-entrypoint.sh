#!/bin/sh

TABLES_EXIST=$(psql "$DB_URL" -tAc "SELECT to_regclass('public.flight');") # This table should exist in the database

if [ -z "$TABLES_EXIST" ]; then
  echo "New installation. Syncing tables..."
  bunx prisma db push --skip-generate
else
  echo "Existing database detected. Applying migrations..."
  bunx prisma migrate resolve --applied 0_init # https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining
  bunx prisma migrate deploy
fi

echo "Starting server..."
export PROTOCOL_HEADER=x-forwarded-proto
export HOST_HEADER=x-forwarded-host
exec bun ./build