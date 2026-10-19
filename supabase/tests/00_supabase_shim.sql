-- TEST-ONLY shim that imitates the parts of Supabase the migration depends on.
-- Hosted Supabase already has all of this. NEVER run this file against a real project.

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema auth;
create table auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  raw_user_meta_data jsonb
);

-- Same contract as Supabase: read the caller's id from the request JWT claims.
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

grant usage on schema public to anon, authenticated;
grant usage on schema auth   to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
