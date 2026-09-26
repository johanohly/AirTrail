#!/bin/sh

# The container starts as root so it can hand the uploads directory to
# PUID:PGID (1000:1000 by default) and then drop to that user. NAS platforms
# like Unraid and Synology own their shares with other IDs, and volumes on
# hosts like Railway are created root-owned. When the container is started as
# a non-root user instead (`user:` in Compose), it runs as that user and leaves
# permissions alone.
if [ "$(id -u)" = "0" ] && [ "${PUID:-1000}" != "0" ]; then
  PUID="${PUID:-1000}"
  PGID="${PGID:-1000}"
  UPLOADS="${UPLOAD_LOCATION:-/app/uploads}"
  if [ -d "$UPLOADS" ]; then
    # Only touch what is wrong, so large upload folders start quickly.
    find "$UPLOADS" \( ! -user "$PUID" -o ! -group "$PGID" \) \
      -exec chown "$PUID:$PGID" {} +
  fi
  exec setpriv --reuid="$PUID" --regid="$PGID" --clear-groups "$0" "$@"
fi

echo "Applying migrations..."
node ./docker/migrate.js

echo "Starting server..."
export PROTOCOL_HEADER=x-forwarded-proto
export HOST_HEADER=x-forwarded-host
exec node ./build
