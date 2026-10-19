-- Tiny assertion library. A failed assertion raises, which aborts the run.
create schema tests;
grant usage on schema tests to anon, authenticated;

-- Become a signed-in user (role `authenticated` + JWT sub claim), like PostgREST does.
create function tests.login(uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create function tests.anon() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
end $$;

create function tests.admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Statement must fail with the given SQLSTATE (e.g. 42501 = permission denied / RLS).
create function tests.denied(label text, stmt text, expected_state text default '42501')
returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if sqlstate = expected_state then
      raise notice 'ok - %', label;
      return;
    end if;
    raise exception 'FAIL - %: expected SQLSTATE % but got % (%)', label, expected_state, sqlstate, sqlerrm;
  end;
  raise exception 'FAIL - %: statement succeeded but should have failed', label;
end $$;

-- Statement must succeed.
create function tests.allowed(label text, stmt text) returns void language plpgsql as $$
begin
  execute stmt;
  raise notice 'ok - %', label;
exception when others then
  raise exception 'FAIL - %: unexpectedly failed with % (%)', label, sqlstate, sqlerrm;
end $$;

-- Query returns exactly n rows (for SELECT) - use for visibility checks.
create function tests.rows(label text, query text, n bigint) returns void language plpgsql as $$
declare got bigint;
begin
  execute format('select count(*) from (%s) q', query) into got;
  if got <> n then raise exception 'FAIL - %: expected % rows, got %', label, n, got; end if;
  raise notice 'ok - %', label;
end $$;

-- DML must affect exactly n rows (RLS hides rows rather than erroring on UPDATE/DELETE).
create function tests.affects(label text, stmt text, n bigint) returns void language plpgsql as $$
declare got bigint;
begin
  execute stmt;
  get diagnostics got = row_count;
  if got <> n then raise exception 'FAIL - %: expected % rows affected, got %', label, n, got; end if;
  raise notice 'ok - %', label;
end $$;

create function tests.is_true(label text, query text) returns void language plpgsql as $$
declare v boolean;
begin
  execute query into v;
  if v is not true then raise exception 'FAIL - %: expected true', label; end if;
  raise notice 'ok - %', label;
end $$;

grant execute on all functions in schema tests to anon, authenticated;
