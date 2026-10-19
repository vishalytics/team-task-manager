#!/usr/bin/env bash
# Runs the database permission tests against a THROWAWAY local PostgreSQL database.
#
#   su postgres -c "bash supabase/tests/run.sh"     # or any local superuser via PG* env vars
#
# Safety: refuses to run unless the server is local (socket, localhost, 127.0.0.1),
# and only ever creates/drops the database named below. Never point it at Supabase.
set -euo pipefail

cd "$(dirname "$0")"
DB="${TEST_DB_NAME:-tasks_rls_test}"
HOST="${PGHOST:-}"

case "$HOST" in
  ""|localhost|127.0.0.1|/*) ;;
  *) echo "Refusing to run: PGHOST='$HOST' is not a local server." >&2; exit 2 ;;
esac
if [ -n "${DATABASE_URL:-}" ] || [ -n "${PGPASSWORD:-}" ]; then
  echo "Refusing to run with DATABASE_URL/PGPASSWORD set; this script only uses a local passwordless superuser." >&2
  exit 2
fi

PSQL=(psql -X -q -v ON_ERROR_STOP=1 -d postgres)
"${PSQL[@]}" -c "drop database if exists ${DB} with (force)" -c "create database ${DB}"
trap '"${PSQL[@]}" -c "drop database if exists ${DB} with (force)" >/dev/null' EXIT

# Roles are cluster-wide; drop leftovers from earlier runs so the shim starts clean.
"${PSQL[@]}" -c "do \$\$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then drop owned by anon, authenticated, service_role cascade; drop role anon, authenticated, service_role; end if;
end \$\$" 2>/dev/null || true

OUT="$(mktemp)"
psql -X -q -o /dev/null -v ON_ERROR_STOP=1 -d "$DB" \
  -f 00_supabase_shim.sql \
  -f ../migrations/20260930000000_database_foundation.sql \
  -f 01_helpers.sql \
  -f 10_permissions.sql 2>&1 | tee "$OUT"

PASS=$(grep -c 'NOTICE:  ok - ' "$OUT" || true)
echo "Database tests: ${PASS} assertions passed, 0 failed."
rm -f "$OUT"

# Concurrency tests need committed data and several real connections (separate script).
bash 20_concurrency.sh "$DB"
