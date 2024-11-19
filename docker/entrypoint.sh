#!/bin/sh

echo "Applying migrations..."
bunx prisma migrate deploy

echo "Starting server..."
export PROTOCOL_HEADER=x-forwarded-proto
export HOST_HEADER=x-forwarded-host
exec bun ./build