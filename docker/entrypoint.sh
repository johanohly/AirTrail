#!/bin/sh

echo "Applying migrations..."
node ./docker/migrate.js

echo "Starting server..."
export PROTOCOL_HEADER=x-forwarded-proto
export HOST_HEADER=x-forwarded-host
exec node ./build
