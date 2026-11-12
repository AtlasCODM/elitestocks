#!/usr/bin/env bash
set -euo pipefail
# Uses a fresh temporary LOCAL cluster with no network listener, credentials or remote URLs.
ROOT=$(cd "$(dirname "$0")/.." && pwd)
PROFILE="${1:-repository}"
case "$PROFILE" in repository|--live-schema) ;; *) echo 'Use no argument or --live-schema' >&2; exit 2 ;; esac
PG_BIN=${PG_BIN:-$(pg_config --bindir)}
WORK=$(mktemp -d /tmp/elitestocks-engine-test.XXXXXX)
cleanup() {
  "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate -w stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT
"$PG_BIN/initdb" -D "$WORK/data" -A trust --no-locale > "$WORK/init.log"
"$PG_BIN/pg_ctl" -D "$WORK/data" -o "-F -k $WORK -c listen_addresses='' -c wal_level=logical" -l "$WORK/postgres.log" -w start > /dev/null
export PGHOST="$WORK" PGDATABASE=postgres PGUSER="$(id -un)"
psql -X -v ON_ERROR_STOP=1 -f "$ROOT/tests/database-fixture.sql" > "$WORK/migrations.log"
for migration in "$ROOT"/supabase/migrations/*.sql; do
  # This existing migration only enables Supabase-managed pg_cron/pg_net extensions;
  # neither is needed by the new RPCs and vanilla PostgreSQL does not provide pg_net.
  case "$migration" in *20260531040108*) continue ;; esac
  if [[ "$migration" == *20261112190000* ]]; then
    psql -X -v ON_ERROR_STOP=1 -f "$ROOT/tests/legacy-seed.sql" >> "$WORK/migrations.log"
    if [[ "$PROFILE" == --live-schema ]]; then
      psql -X -v ON_ERROR_STOP=1 -f "$ROOT/tests/live-schema-fixture.sql" >> "$WORK/migrations.log"
    fi
  fi
  printf 'Applying %s\n' "$(basename "$migration")"
  psql -X -v ON_ERROR_STOP=1 -f "$migration" >> "$WORK/migrations.log" 2>&1 || { cat "$WORK/migrations.log"; exit 1; }
done
if [[ "$PROFILE" == --live-schema ]]; then
  psql -X -v ON_ERROR_STOP=1 -f "$ROOT/tests/live-schema-regression.sql"
fi
psql -X -v ON_ERROR_STOP=1 -f "$ROOT/tests/investment-engine-database.sql"
psql -X -v ON_ERROR_STOP=1 -f "$ROOT/tests/database-edge-cases.sql"
psql -X -v ON_ERROR_STOP=1 -f "$ROOT/tests/database-decimal-precision.sql"
# Additional multi-session contention checks, if present.
if test -f "$ROOT/tests/database-concurrency.py"; then python3 "$ROOT/tests/database-concurrency.py"; fi
printf '\nIsolated database regression suite passed. No live database was accessed.\n'
