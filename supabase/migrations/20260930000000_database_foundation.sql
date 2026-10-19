-- =============================================================================
-- Nutrabay Task Manager - database foundation
-- Target: Supabase (PostgreSQL 15+), run once in the SQL Editor as `postgres`.
--
-- Creates: workspaces, profiles, workspace_members, projects, project_members,
--          tasks - with constraints, indexes, triggers, RLS and explicit grants.
--
-- Security model (summary - full text in supabase/README.md):
--   * Identity = Supabase Auth user id (auth.users.id). profiles.id references it.
--   * Roles: workspace admin / workspace member. Project access is explicit
--     (project_members); a workspace membership alone grants no project access.
--   * Every table has RLS enabled. `anon` gets NO grants. `authenticated` gets
--     only the table/column privileges listed in section 7, and RLS narrows
--     those further.
--   * Nobody can create a workspace, or the first admin, through the API. That is
--     done by the project owner in the dashboard (see SETUP.md).
--   * Not idempotent on purpose: re-running fails instead of silently altering
--     security objects.
-- =============================================================================

begin;

-- 1. Private schema for helper functions ---------------------------------------
-- Not exposed through the Data API, so helpers are never callable as RPCs.
create schema private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- 2. Tables --------------------------------------------------------------------

create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 100),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- One row per Supabase Auth user. No email/phone stored here on purpose.
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null check (char_length(btrim(display_name)) between 1 and 100),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  role          text not null default 'member' check (role in ('admin', 'member')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.projects (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 1 and 100),
  description   text not null default '' check (char_length(description) <= 2000),
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (workspace_id, name),
  -- Lets child tables prove project and workspace agree (composite FKs below).
  unique (id, workspace_id)
);

-- Explicit project membership. A project member must already be a member of the
-- project's workspace (enforced by the composite foreign keys).
create table public.project_members (
  project_id    uuid not null,
  workspace_id  uuid not null,
  user_id       uuid not null,
  created_at    timestamptz not null default now(),
  primary key (project_id, user_id),
  foreign key (project_id, workspace_id)
    references public.projects (id, workspace_id) on delete cascade,
  foreign key (workspace_id, user_id)
    references public.workspace_members (workspace_id, user_id) on delete cascade
);

create table public.tasks (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null,
  project_id    uuid not null,
  title         text not null check (char_length(btrim(title)) between 1 and 200),
  description   text not null default '' check (char_length(description) <= 5000),
  -- One assignee, who must belong to the task's project. Becomes NULL
  -- (unassigned) if that person is removed from the project.
  assignee_id   uuid,
  priority      text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status        text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  due_date      date not null,
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  foreign key (project_id, workspace_id)
    references public.projects (id, workspace_id) on delete cascade,
  foreign key (project_id, assignee_id)
    references public.project_members (project_id, user_id)
    on delete set null (assignee_id)
);

-- 3. Indexes (membership checks + common task queries) ---------------------------
-- workspace_members PK (workspace_id, user_id) serves "is X in workspace W".
create index workspace_members_user_idx        on public.workspace_members (user_id);
-- project_members PK (project_id, user_id) serves "is X in project P".
create index project_members_user_idx          on public.project_members (user_id);
create index project_members_ws_user_idx       on public.project_members (workspace_id, user_id);
-- projects: unique (workspace_id, name) already indexes workspace_id.
create index tasks_project_status_idx          on public.tasks (project_id, status);
create index tasks_assignee_status_due_idx     on public.tasks (assignee_id, status, due_date);
create index tasks_workspace_due_idx           on public.tasks (workspace_id, due_date);
create index tasks_created_by_idx              on public.tasks (created_by);

-- 4. Triggers --------------------------------------------------------------------

create function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;

create trigger workspaces_set_updated_at        before update on public.workspaces
  for each row execute function private.set_updated_at();
create trigger profiles_set_updated_at          before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger workspace_members_set_updated_at before update on public.workspace_members
  for each row execute function private.set_updated_at();
create trigger projects_set_updated_at          before update on public.projects
  for each row execute function private.set_updated_at();
create trigger tasks_set_updated_at             before update on public.tasks
  for each row execute function private.set_updated_at();

-- Never leave a workspace without an admin (no lock-out via demote/remove).
-- Deleting the whole workspace is still allowed.
--
-- Concurrency: a plain "does another admin exist?" check is not enough. Two
-- transactions could each demote/remove a DIFFERENT admin, each see the other one
-- still there, and both commit -> zero admins. So:
--   1. lock the workspace row (FOR NO KEY UPDATE). All admin demotions/removals of
--      one workspace now run one after another. It does not block inserts of
--      members/projects/tasks (those only take FOR KEY SHARE on the row).
--   2. only AFTER the lock is held, count the other admins. In READ COMMITTED each
--      statement takes a new snapshot, so this read sees everything the previous
--      transaction committed - a fresh check, not a stale one.
-- READ COMMITTED is what the Supabase API and SQL Editor use. A fixed snapshot
-- (REPEATABLE READ / SERIALIZABLE) cannot give a fresh check, so those levels are
-- refused rather than silently unsafe.
-- Lock order note: PostgreSQL locks the target member row before this trigger runs,
-- so an admin change racing a DELETE of the whole workspace can, in rare interleavings,
-- end in a deadlock. PostgreSQL detects it and aborts one statement (retry it); no
-- data is ever left inconsistent.
create function private.protect_last_admin()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'admin' and (tg_op = 'DELETE' or new.role <> 'admin') then
    perform 1 from public.workspaces w where w.id = old.workspace_id for no key update;
    -- No row: the workspace is being deleted (this is its cascade) or is gone.
    -- Nothing to protect, so whole-workspace deletion keeps working.
    if found then
      if current_setting('transaction_isolation') <> 'read committed' then
        raise exception 'Changing workspace admins requires READ COMMITTED isolation'
          using errcode = '25000';
      end if;
      if not exists (
        select 1 from public.workspace_members m
        where m.workspace_id = old.workspace_id and m.role = 'admin' and m.user_id <> old.user_id
      ) then
        raise exception 'A workspace must keep at least one admin';
      end if;
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create trigger workspace_members_protect_last_admin
  before update or delete on public.workspace_members
  for each row execute function private.protect_last_admin();

-- Every new Auth user gets a profile. It grants NO workspace access and is never
-- an admin: anyone who can sign up is just an outsider until an admin adds them.
create function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(split_part(coalesce(new.email, ''), '@', 1)), ''),
      'New user'), 100)
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Profiles for users that already exist (none expected on a fresh project).
insert into public.profiles (id, display_name)
select u.id,
       left(coalesce(nullif(btrim(split_part(coalesce(u.email, ''), '@', 1)), ''), 'New user'), 100)
from auth.users u
on conflict (id) do nothing;

-- 5. Permission helpers ------------------------------------------------------------
-- SECURITY DEFINER so policies can read membership tables without recursing into
-- their own RLS. They only ever answer questions about the calling user.

create function private.is_workspace_member(ws uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = (select auth.uid())
  )
$$;

create function private.is_workspace_admin(ws uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = (select auth.uid()) and m.role = 'admin'
  )
$$;

-- Project member OR admin of the project's workspace.
create function private.has_project_access(project uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.project_members pm
    where pm.project_id = project and pm.user_id = (select auth.uid())
  ) or exists (
    select 1
    from public.projects p
    join public.workspace_members m on m.workspace_id = p.workspace_id
    where p.id = project and m.user_id = (select auth.uid()) and m.role = 'admin'
  )
$$;

create function private.shares_workspace_with(other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.workspace_members mine
    join public.workspace_members theirs on theirs.workspace_id = mine.workspace_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = other
  )
$$;

revoke all on function
  private.set_updated_at(), private.protect_last_admin(), private.handle_new_user(),
  private.is_workspace_member(uuid), private.is_workspace_admin(uuid),
  private.has_project_access(uuid), private.shares_workspace_with(uuid)
  from public;
-- Policies run with the caller's privileges, so callers need EXECUTE on helpers
-- used in policies. Trigger functions need no grant.
grant execute on function
  private.is_workspace_member(uuid), private.is_workspace_admin(uuid),
  private.has_project_access(uuid), private.shares_workspace_with(uuid)
  to authenticated;

-- 6. Row Level Security --------------------------------------------------------------
alter table public.workspaces        enable row level security;
alter table public.profiles          enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects          enable row level security;
alter table public.project_members   enable row level security;
alter table public.tasks             enable row level security;

-- workspaces: members read; admins rename. No insert/delete via the API.
create policy workspaces_select on public.workspaces for select to authenticated
  using (private.is_workspace_member(id));
create policy workspaces_update on public.workspaces for update to authenticated
  using (private.is_workspace_admin(id)) with check (private.is_workspace_admin(id));

-- profiles: you and people who share a workspace with you; you edit only yourself.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_workspace_with(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- workspace_members: members see the roster; ONLY admins change it.
create policy workspace_members_select on public.workspace_members for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy workspace_members_insert on public.workspace_members for insert to authenticated
  with check (private.is_workspace_admin(workspace_id));
create policy workspace_members_update on public.workspace_members for update to authenticated
  using (private.is_workspace_admin(workspace_id)) with check (private.is_workspace_admin(workspace_id));
create policy workspace_members_delete on public.workspace_members for delete to authenticated
  using (private.is_workspace_admin(workspace_id));

-- projects: visible to project members and workspace admins; admins manage.
create policy projects_select on public.projects for select to authenticated
  using (private.has_project_access(id));
create policy projects_insert on public.projects for insert to authenticated
  with check (private.is_workspace_admin(workspace_id));
create policy projects_update on public.projects for update to authenticated
  using (private.is_workspace_admin(workspace_id)) with check (private.is_workspace_admin(workspace_id));
create policy projects_delete on public.projects for delete to authenticated
  using (private.is_workspace_admin(workspace_id));

-- project_members: visible to project members and admins; ONLY admins change it.
create policy project_members_select on public.project_members for select to authenticated
  using (private.has_project_access(project_id));
create policy project_members_insert on public.project_members for insert to authenticated
  with check (private.is_workspace_admin(workspace_id));
create policy project_members_delete on public.project_members for delete to authenticated
  using (private.is_workspace_admin(workspace_id));

-- tasks: project members and workspace admins read/create/edit. USING checks the
-- existing row's project, WITH CHECK the new row's project - so a task cannot be
-- moved into a project the caller has no access to. Only admins delete.
create policy tasks_select on public.tasks for select to authenticated
  using (private.has_project_access(project_id));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (private.has_project_access(project_id));
create policy tasks_update on public.tasks for update to authenticated
  using (private.has_project_access(project_id)) with check (private.has_project_access(project_id));
create policy tasks_delete on public.tasks for delete to authenticated
  using (private.is_workspace_admin(workspace_id));

-- 7. Grants ---------------------------------------------------------------------------
-- Auto-exposure of new tables is off, but start from zero regardless of defaults.
revoke all on public.workspaces, public.profiles, public.workspace_members,
              public.projects, public.project_members, public.tasks
  from public, anon, authenticated;

-- `anon` (not signed in) receives nothing.
grant select on public.workspaces, public.profiles, public.workspace_members,
                public.projects, public.project_members, public.tasks
  to authenticated;

-- Column-level writes: identity, ownership and timestamp columns are never writable.
grant update (name)                         on public.workspaces        to authenticated;
grant update (display_name)                 on public.profiles          to authenticated;
grant insert (workspace_id, user_id, role)  on public.workspace_members to authenticated;
grant update (role)                         on public.workspace_members to authenticated;
grant delete                                on public.workspace_members to authenticated;
grant insert (workspace_id, name, description) on public.projects       to authenticated;
grant update (name, description)            on public.projects          to authenticated;
grant delete                                on public.projects          to authenticated;
grant insert (project_id, workspace_id, user_id) on public.project_members to authenticated;
grant delete                                on public.project_members   to authenticated;
grant insert (workspace_id, project_id, title, description, assignee_id, priority, status, due_date)
                                            on public.tasks             to authenticated;
grant update (project_id, title, description, assignee_id, priority, status, due_date)
                                            on public.tasks             to authenticated;
grant delete                                on public.tasks             to authenticated;

commit;
