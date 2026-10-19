-- Provision the FIRST workspace and its first admin.
--
-- Run manually in the Supabase SQL Editor (as the project owner) AFTER the
-- intended admin has signed in/accepted their invite at least once.
-- Never automate this and never make "whoever signs up first" an admin.
--
-- 1. Dashboard -> Authentication -> Users -> find the person -> copy their UUID.
--    Confirm the email is the one you expect.
-- 2. Replace the two values below (keep the quotes), then Run.

do $$
declare
  v_admin_id       uuid := 'PASTE-USER-UUID-HERE';
  v_workspace_name text := 'Nutrabay';
  v_workspace_id   uuid;
begin
  if not exists (select 1 from auth.users where id = v_admin_id) then
    raise exception 'No Auth user with that id. Has the person signed in yet?';
  end if;
  if not exists (select 1 from public.profiles where id = v_admin_id) then
    raise exception 'No profile for that user. Was the migration applied before they signed up?';
  end if;
  if exists (select 1 from public.workspaces where name = v_workspace_name) then
    raise exception 'Workspace % already exists. Add further people as a workspace admin instead.', v_workspace_name;
  end if;

  insert into public.workspaces (name) values (v_workspace_name) returning id into v_workspace_id;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, v_admin_id, 'admin');

  raise notice 'Created workspace % (%) with admin %', v_workspace_name, v_workspace_id, v_admin_id;
end $$;
