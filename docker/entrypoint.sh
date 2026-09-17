#!/bin/sh

echo "Applying migrations..."
node ./docker/migrate.js

echo "Starting server..."
export PROTOCOL_HEADER=x-forwarded-proto
export HOST_HEADER=x-forwarded-host
# Rate limiting is keyed on the client address; without this every request
# behind the reverse proxy would resolve to the proxy's own address and share
# one bucket. XFF_DEPTH defaults to 1, which is the address the proxy saw.
export ADDRESS_HEADER=x-forwarded-for
exec node ./build
