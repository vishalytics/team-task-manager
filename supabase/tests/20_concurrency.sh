#!/usr/bin/env bash
# Concurrency tests for the last-admin guard, using SEPARATE PostgreSQL connections
# (independent backend processes, real locking). Called by run.sh with the scratch
# database name; also usable on its own:  bash 20_concurrency.sh <scratch_db>
#
# Part 1 - orchestrated: session A holds an open transaction, session B must BLOCK on
#          the workspace lock, then fail after A commits (fresh re-check).
# Part 2 - stress: N sessions start together, each demotes/removes a different admin
#          while holding its transaction open briefly; at least one admin must remain.
#
# Scratch files live in a mktemp directory under the system temp dir (small; left to the OS).
set -euo pipefail

DB="${1:?usage: 20_concurrency.sh <scratch database>}"
case "${PGHOST:-}" in ""|localhost|127.0.0.1|/*) ;; *) echo "Refusing non-local PGHOST" >&2; exit 2 ;; esac

WS='e0000000-0000-0000-0000-000000000001'
uid() { printf 'd0000000-0000-0000-0000-%012d' "$1"; }
TMP="$(mktemp -d)"
GEN=0
PASSED=0
sq() { psql -X -q -A -t -v ON_ERROR_STOP=1 -d "$DB" "$@"; }   # superuser one-shot
ok()   { PASSED=$((PASSED + 1)); echo "ok - $1"; }
fail() { echo "FAIL - $1" >&2; exit 1; }
cleanup() {
  exec 3>&- 4>&- 2>/dev/null || true
  jobs -p | xargs -r kill 2>/dev/null || true
  sq -c "delete from public.workspaces where id = '$WS'; delete from auth.users where email like 'conc-%@example.test'" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Fresh workspace with $1 admins (users 1..$1) - committed data.
reset_fixture() {
  local n=$1
  sq -c "delete from public.workspaces where id = '$WS'; delete from auth.users where email like 'conc-%@example.test'"
  for i in $(seq 1 "$n"); do
    sq -c "insert into auth.users (id, email) values ('$(uid "$i")', 'conc-$i@example.test')"
  done
  sq -c "insert into public.workspaces (id, name) values ('$WS', 'conc-test')"
  for i in $(seq 1 "$n"); do
    sq -c "insert into public.workspace_members (workspace_id, user_id, role) values ('$WS', '$(uid "$i")', 'admin')"
  done
}
admin_count() { sq -c "select count(*) from public.workspace_members where workspace_id = '$WS' and role = 'admin'"; }
member_rows() { sq -c "select count(*) from public.workspace_members where workspace_id = '$WS'"; }

# ---- long-lived interactive sessions (A = fd 3, B = fd 4) ----
out() { echo "$TMP/$GEN-$1.out"; }
start_session() { # name fd
  mkfifo "$TMP/$GEN-$1.in"
  psql -X -q -A -t -d "$DB" < "$TMP/$GEN-$1.in" > "$(out "$1")" 2>&1 &
  case "$2" in 3) exec 3>"$TMP/$GEN-$1.in" ;; 4) exec 4>"$TMP/$GEN-$1.in" ;; esac
}
send() { # fd text
  case "$1" in 3) printf '%s\n' "$2" >&3 ;; 4) printf '%s\n' "$2" >&4 ;; esac
}
# Run a statement in a session and tag the outcome (OK/ERR + row count) on stderr.
run_tagged() { # fd tag sql
  send "$1" "$3"
  send "$1" '\if :ERROR'
  send "$1" "\\warn $2:ERR"
  send "$1" '\else'
  send "$1" "\\warn $2:OK:rows=:ROW_COUNT"
  send "$1" '\endif'
}
login() { # fd user-number
  send "$1" "set role authenticated;"
  send "$1" "select set_config('request.jwt.claims', json_build_object('sub','$(uid "$2")','role','authenticated')::text, false);"
}
wait_for() { # session pattern what
  local t=300
  while ! grep -q -- "$2" "$(out "$1")" 2>/dev/null; do
    t=$((t - 1)); [ "$t" -gt 0 ] || fail "timeout waiting for '$2' in session $1 ($3)"
    sleep 0.05
  done
}
wait_blocked() { # a backend is waiting on a heavyweight lock held by another session
  local t=300
  while [ "$(sq -c "select count(*) from pg_stat_activity where datname = '$DB' and wait_event_type = 'Lock' and pid <> pg_backend_pid()")" = 0 ]; do
    t=$((t - 1)); [ "$t" -gt 0 ] || fail "session B never blocked on a lock ($1) - writers are not serialized"
    sleep 0.05
  done
}
end_sessions() { send 3 '\q'; send 4 '\q'; exec 3>&- 4>&-; wait; GEN=$((GEN + 1)); }

# Orchestrated scenario: A acts first and stays uncommitted; B must wait, then be refused.
#   scenario <label> <actor A> <sql A> <actor B> <sql B>
scenario() {
  local label=$1 ua=$2 sqla=$3 ub=$4 sqlb=$5
  reset_fixture 2
  start_session A 3; start_session B 4
  login 3 "$ua"; login 4 "$ub"
  send 3 'begin;'; send 4 'begin;'
  run_tagged 3 A "$sqla"
  wait_for A 'A:OK:rows=1' "$label: first change should succeed"
  run_tagged 4 B "$sqlb"                      # B must now block on the workspace lock
  wait_blocked "$label"
  if grep -q 'B:' "$(out B)"; then fail "$label: B finished while A was uncommitted"; fi
  ok "$label: second session blocks while the first transaction is open"
  send 3 'commit;'
  wait_for B 'B:ERR' "$label: B should be refused after A commits"
  grep -q 'A workspace must keep at least one admin' "$(out B)" || fail "$label: B failed for the wrong reason: $(cat "$(out B)")"
  ok "$label: second session is refused after re-checking committed state"
  send 4 'rollback;'
  end_sessions
  [ "$(admin_count)" = 1 ] || fail "$label: expected exactly 1 admin left, got $(admin_count)"
  ok "$label: exactly one admin remains after both transactions finished"
}

U1=$(uid 1); U2=$(uid 2)
demote() { echo "update public.workspace_members set role = 'member' where workspace_id = '$WS' and user_id = '$1';"; }
remove() { echo "delete from public.workspace_members where workspace_id = '$WS' and user_id = '$1';"; }

# Each admin acts on the OTHER admin - each change is valid in isolation.
scenario "demote vs demote"  1 "$(demote "$U2")" 2 "$(demote "$U1")"
scenario "remove vs remove"  1 "$(remove "$U2")" 2 "$(remove "$U1")"
scenario "demote vs remove"  1 "$(demote "$U2")" 2 "$(remove "$U1")"
scenario "remove vs demote"  1 "$(remove "$U2")" 2 "$(demote "$U1")"
# Two admins each step down themselves.
scenario "self-demote vs self-demote" 1 "$(demote "$U1")" 2 "$(demote "$U2")"
scenario "self-remove vs self-remove" 1 "$(remove "$U1")" 2 "$(remove "$U2")"

# Whole-workspace deletion must keep working, with or without a concurrent change.
reset_fixture 2
sq -c "delete from public.workspaces where id = '$WS'" || fail "plain workspace delete failed"
[ "$(sq -c "select count(*) from public.workspaces where id = '$WS'")" = 0 ] || fail "workspace still exists"
ok "workspace with several admins can be deleted (cascade bypasses the last-admin guard)"

reset_fixture 2   # demotion first (uncommitted), workspace delete waits, then succeeds
start_session A 3; start_session B 4
login 3 1; send 3 'begin;'; run_tagged 3 A "$(demote "$U2")"; wait_for A 'A:OK:rows=1' "setup"
run_tagged 4 B "delete from public.workspaces where id = '$WS';"
wait_blocked "workspace delete vs demotion"
send 3 'commit;'; wait_for B 'B:OK:rows=1' "workspace delete should succeed after the demotion commits"
end_sessions
[ "$(member_rows)" = 0 ] || fail "members remain after workspace delete"
ok "workspace delete waits for a concurrent demotion and then succeeds"

reset_fixture 2   # workspace delete first (uncommitted); a concurrent demotion must not error or hang
start_session A 3; start_session B 4
send 3 'begin;'; run_tagged 3 A "delete from public.workspaces where id = '$WS';"; wait_for A 'A:OK:rows=1' "setup"
login 4 1; send 4 'begin;'; run_tagged 4 B "$(demote "$U2")"
wait_blocked "demotion vs workspace delete"
send 3 'commit;'; wait_for B 'B:OK:rows=0' "demotion should find the row gone"
send 4 'commit;'; end_sessions
[ "$(sq -c "select count(*) from public.workspaces where id = '$WS'")" = 0 ] || fail "workspace should be gone"
ok "demotion racing a workspace delete completes without error or deadlock"

# Snapshot isolation cannot give a fresh check, so it must be refused (not silently unsafe).
reset_fixture 2
for level in "repeatable read" "serializable"; do
  if sq -c "begin isolation level $level; update public.workspace_members set role = 'member' where workspace_id = '$WS' and user_id = '$U2'; commit;" 2>"$TMP/iso.err"; then
    fail "demotion under $level should be refused"
  fi
  grep -q 'requires READ COMMITTED' "$TMP/iso.err" || fail "wrong error under $level: $(cat "$TMP/iso.err")"
done
[ "$(admin_count)" = 2 ] || fail "admins changed by a refused statement"
ok "admin changes are refused under REPEATABLE READ / SERIALIZABLE, and nothing is modified"
sq -c "begin isolation level serializable; delete from public.workspaces where id = '$WS'; commit;" || fail "workspace delete must work at any isolation level"
ok "whole-workspace delete still works under SERIALIZABLE"

# ---- Part 2: stress. N sessions begin together, each changes a different admin ----
# worker <n> <index> <mode>: acts as admin <index> on admin <index+1 mod n>, then holds
# the transaction open 150 ms so the sessions genuinely overlap.
worker() {
  local n=$1 i=$2 mode=$3 target=$(( i % $1 + 1 )) stmt
  if [ "$mode" = demote ]; then stmt=$(demote "$(uid "$target")"); else stmt=$(remove "$(uid "$target")"); fi
  psql -X -q -v ON_ERROR_STOP=1 -d "$DB" >/dev/null 2>"$TMP/w$i.err" <<SQL
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','$(uid "$i")','role','authenticated')::text, false);
begin;
$stmt
select pg_sleep(0.15);
commit;
SQL
}
stress() { # admins rounds mode
  local n=$1 rounds=$2 mode=$3 okc=0 errc=0 minadm=99
  for r in $(seq 1 "$rounds"); do
    reset_fixture "$n"
    local pids=() succ=0
    for i in $(seq 1 "$n"); do : > "$TMP/w$i.err"; worker "$n" "$i" "$mode" & pids+=($!); done
    for p in "${pids[@]}"; do if wait "$p"; then succ=$((succ + 1)); else errc=$((errc + 1)); fi; done
    okc=$((okc + succ))
    local adm; adm=$(admin_count)
    [ "$adm" -ge 1 ] || fail "stress $n-admins/$mode round $r: workspace left with $adm admins"
    [ "$adm" -lt "$minadm" ] && minadm=$adm
    # Each worker targets a distinct admin in a cycle, so exactly n-1 can succeed.
    [ "$succ" -eq $((n - 1)) ] || fail "stress $n-admins/$mode round $r: $succ succeeded, expected $((n - 1)); admins=$adm"
    for i in $(seq 1 "$n"); do
      if grep 'ERROR' "$TMP/w$i.err" | grep -qv 'A workspace must keep at least one admin'; then fail "unexpected error: $(cat "$TMP/w$i.err")"; fi
    done
  done
  ok "stress: $n simultaneous admins x $rounds rounds ($mode): $okc succeeded, $errc refused, never fewer than $minadm admin(s) left"
}
for mode in demote remove; do
  stress 2 15 "$mode"
  stress 3 10 "$mode"
done

echo "Concurrency tests: ${PASSED} checks passed (two or more independent connections), 0 failed."
