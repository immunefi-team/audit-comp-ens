#!/bin/sh
# Runs the Panoptes indexer (background) and GraphQL API in one container so
# they share the sqlite database without a shared volume (Railway volumes are
# single-service). If either process dies the container exits so Railway's
# restart policy brings both back up together.
#
# POSIX sh only — no bash-isms (`wait -n` is not POSIX and silently no-ops in
# dash/sh, which previously let a dead indexer leave the container "healthy").
set -eu

mkdir -p /app/data
DB="${DATABASE_PATH:-/app/data/ens_v2.db}"

echo "[railway-entrypoint] starting indexer..."
/app/ensv2-indexer-v2 &
INDEXER_PID=$!

# Wait until the indexer has actually created the database before the API
# opens it (was a fixed `sleep 5` that raced DB creation). Bail if the indexer
# dies first; give up waiting after ~60s but still start the API.
i=0
while [ ! -f "$DB" ] && [ "$i" -lt 60 ]; do
  if ! kill -0 "$INDEXER_PID" 2>/dev/null; then
    echo "[railway-entrypoint] indexer exited before creating $DB" >&2
    exit 1
  fi
  sleep 1
  i=$((i + 1))
done
if [ ! -f "$DB" ]; then
  echo "[railway-entrypoint] warning: $DB not present after ${i}s; starting API anyway" >&2
fi

echo "[railway-entrypoint] starting API..."
/app/api-entrypoint.sh &
API_PID=$!

# Supervise both children. Exit as soon as EITHER dies so a crashed indexer
# can't leave a container that reports healthy forever.
while kill -0 "$INDEXER_PID" 2>/dev/null && kill -0 "$API_PID" 2>/dev/null; do
  sleep 5
done

echo "[railway-entrypoint] a child process exited; shutting down container" >&2
kill "$INDEXER_PID" "$API_PID" 2>/dev/null || true
exit 1
