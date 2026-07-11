#!/bin/sh
set -eu
PORT="${PORT:-8080}"
exec /pb/pocketbase serve --http=0.0.0.0:${PORT} --dir=/pb/pb_data --migrationsDir=/pb/pb_migrations
