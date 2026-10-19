-- Permission tests for the database foundation. Everything runs in one transaction
-- that is rolled back at the end. Fictional users only.
begin;

-- ---------------------------------------------------------------- fixtures (as table owner)
-- Users:  adminA (admin WA) | a1 (WA, project PA1) | a2 (WA, project PA2) | a3 (WA, no project)
--         adminB (admin WB) | b1 (WB, project PB1) | out (no workspace at all)
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000001', 'alpha.admin@example.test', '{"full_name":"Alpha Admin"}'),
  ('a0000000-0000-0000-0000-000000000002', 'alpha.one@example.test',   null),
  ('a0000000-0000-0000-0000-000000000003', 'alpha.two@example.test',   null),
  ('a0000000-0000-0000-0000-000000000004', 'alpha.three@example.test', null),
  ('b0000000-0000-0000-0000-000000000001', 'beta.admin@example.test',  null),
  ('b0000000-0000-0000-0000-000000000002', 'beta.one@example.test',    null),
  ('c0000000-0000-0000-0000-000000000001', 'outsider@example.test',    null);

insert into public.workspaces (id, name) values
  ('1a000000-0000-0000-0000-000000000001', 'Workspace Alpha'),
  ('1b000000-0000-0000-0000-000000000001', 'Workspace Beta');

insert into public.workspace_members (workspace_id, user_id, role) values
  ('1a000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'admin'),
  ('1a000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'member'),
  ('1a000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'member'),
  ('1a000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'member'),
  ('1b000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'admin'),
  ('1b000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'member');

insert into public.projects (id, workspace_id, name) values
  ('2a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000001', 'PA1'),
  ('2a000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000001', 'PA2'),
  ('2b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000001', 'PB1');

insert into public.project_members (project_id, workspace_id, user_id) values
  ('2a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002'),
  ('2a000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003'),
  ('2b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002');

insert into public.tasks (id, workspace_id, project_id, title, assignee_id, due_date) values
  ('3a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000001', '2a000000-0000-0000-0000-000000000001', 'TA1', 'a0000000-0000-0000-0000-000000000002', current_date),
  ('3a000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000001', '2a000000-0000-0000-0000-000000000002', 'TA2', 'a0000000-0000-0000-0000-000000000003', current_date),
  ('3b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000001', '2b000000-0000-0000-0000-000000000001', 'TB1', 'b0000000-0000-0000-0000-000000000002', current_date);

-- ---------------------------------------------------------------- structure
select tests.is_true('RLS is enabled on all six tables',
  $$select count(*) = 6 and bool_and(relrowsecurity) from pg_class
    where relnamespace = 'public'::regnamespace and relname in
    ('workspaces','profiles','workspace_members','projects','project_members','tasks')$$);
select tests.is_true('anon has no table privileges at all',
  $$select count(*) = 0 from information_schema.role_table_grants
    where table_schema = 'public' and grantee in ('anon', 'PUBLIC')$$);
select tests.is_true('authenticated has only SELECT/INSERT/UPDATE/DELETE (no TRUNCATE, REFERENCES, TRIGGER)',
  $$select count(*) = 0 from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'authenticated'
      and privilege_type not in ('SELECT','INSERT','UPDATE','DELETE')$$);
select tests.is_true('sign-up trigger created a profile with a display name',
  $$select display_name = 'Alpha Admin' from public.profiles where id = 'a0000000-0000-0000-0000-000000000001'$$);
select tests.is_true('display name falls back to email local part',
  $$select display_name = 'alpha.one' from public.profiles where id = 'a0000000-0000-0000-0000-000000000002'$$);
select tests.is_true('a fresh sign-up has no workspace membership (never auto-admin)',
  $$select count(*) = 0 from public.workspace_members where user_id = 'c0000000-0000-0000-0000-000000000001'$$);

-- ---------------------------------------------------------------- anonymous
select tests.anon();
select tests.denied('anon cannot read workspaces',         'select * from public.workspaces');
select tests.denied('anon cannot read profiles',           'select * from public.profiles');
select tests.denied('anon cannot read workspace_members',  'select * from public.workspace_members');
select tests.denied('anon cannot read projects',           'select * from public.projects');
select tests.denied('anon cannot read project_members',    'select * from public.project_members');
select tests.denied('anon cannot read tasks',              'select * from public.tasks');
select tests.denied('anon cannot insert tasks',
  $$insert into public.tasks (workspace_id, project_id, title, due_date)
    values ('1a000000-0000-0000-0000-000000000001','2a000000-0000-0000-0000-000000000001','x',current_date)$$);
select tests.denied('anon cannot update tasks',   $$update public.tasks set title = 'hacked'$$);
select tests.denied('anon cannot delete tasks',   'delete from public.tasks');
select tests.denied('anon cannot call permission helpers', $$select private.is_workspace_admin('1a000000-0000-0000-0000-000000000001')$$);

-- ---------------------------------------------------------------- authenticated outsider (no workspace)
select tests.login('c0000000-0000-0000-0000-000000000001');
select tests.rows('outsider sees no workspaces',         'select * from public.workspaces', 0);
select tests.rows('outsider sees no workspace members',  'select * from public.workspace_members', 0);
select tests.rows('outsider sees no projects',           'select * from public.projects', 0);
select tests.rows('outsider sees no project members',    'select * from public.project_members', 0);
select tests.rows('outsider sees no tasks',              'select * from public.tasks', 0);
select tests.rows('outsider sees only their own profile','select * from public.profiles', 1);
select tests.denied('outsider cannot create a workspace',
  $$insert into public.workspaces (name) values ('Mine')$$);
select tests.denied('outsider cannot make themselves admin of an existing workspace',
  $$insert into public.workspace_members (workspace_id, user_id, role)
    values ('1a000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','admin')$$);
select tests.denied('outsider cannot create a task',
  $$insert into public.tasks (workspace_id, project_id, title, due_date)
    values ('1a000000-0000-0000-0000-000000000001','2a000000-0000-0000-0000-000000000001','x',current_date)$$);

-- ---------------------------------------------------------------- member a1 (WA, project PA1 only)
select tests.login('a0000000-0000-0000-0000-000000000002');
select tests.rows('member sees own workspace only',        'select * from public.workspaces', 1);
select tests.rows('member sees own workspace roster only', 'select * from public.workspace_members', 4);
select tests.rows('member sees only projects they belong to', 'select * from public.projects', 1);
select tests.rows('member does not see another project in the same workspace',
  $$select * from public.projects where id = '2a000000-0000-0000-0000-000000000002'$$, 0);
select tests.rows('member sees only tasks in their project', 'select * from public.tasks', 1);
select tests.rows('member sees profiles of own workspace only (not workspace Beta)', 'select * from public.profiles', 4);
select tests.rows('member does not see other workspace members',
  $$select * from public.workspace_members where workspace_id = '1b000000-0000-0000-0000-000000000001'$$, 0);
select tests.rows('member sees project roster only for their project', 'select * from public.project_members', 1);

-- create / edit tasks in own project
select tests.allowed('member can create a task in their project, assigned to a project member',
  $$insert into public.tasks (workspace_id, project_id, title, assignee_id, due_date)
    values ('1a000000-0000-0000-0000-000000000001','2a000000-0000-0000-0000-000000000001','New task','a0000000-0000-0000-0000-000000000002',current_date)$$);
select tests.is_true('created_by is stamped with the caller and cannot be chosen',
  $$select created_by = 'a0000000-0000-0000-0000-000000000002' from public.tasks where title = 'New task'$$);
select tests.denied('member cannot set created_by explicitly',
  $$insert into public.tasks (workspace_id, project_id, title, due_date, created_by)
    values ('1a000000-0000-0000-0000-000000000001','2a000000-0000-0000-0000-000000000001','x',current_date,'a0000000-0000-0000-0000-000000000001')$$);
select tests.affects('member can edit and change status of a task in their project',
  $$update public.tasks set status = 'in_progress', priority = 'high' where id = '3a000000-0000-0000-0000-000000000001'$$, 1);
select tests.is_true('updated_at moves forward on edit',
  $$select updated_at > created_at from public.tasks where id = '3a000000-0000-0000-0000-000000000001'$$);

-- denied task operations
select tests.denied('member cannot create a task in a project they do not belong to (same workspace)',
  $$insert into public.tasks (workspace_id, project_id, title, due_date)
    values ('1a000000-0000-0000-0000-000000000001','2a000000-0000-0000-0000-000000000002','x',current_date)$$);
select tests.denied('member cannot create a task in another workspace',
  $$insert into public.tasks (workspace_id, project_id, title, due_date)
    values ('1b000000-0000-0000-0000-000000000001','2b000000-0000-0000-0000-000000000001','x',current_date)$$);
select tests.denied('member cannot smuggle a task into another workspace via a mismatched workspace_id',
  $$insert into public.tasks (workspace_id, project_id, title, due_date)
    values ('1b000000-0000-0000-0000-000000000001','2a000000-0000-0000-0000-000000000001','x',current_date)$$, '23503');
select tests.denied('task assignee must belong to the project (workspace member without project access)',
  $$insert into public.tasks (workspace_id, project_id, title, assignee_id, due_date)
    values ('1a000000-0000-0000-0000-000000000001','2a000000-0000-0000-0000-000000000001','x','a0000000-0000-0000-0000-000000000004',current_date)$$, '23503');
select tests.denied('task assignee must belong to the project (member of another project)',
  $$update public.tasks set assignee_id = 'a0000000-0000-0000-0000-000000000003' where id = '3a000000-0000-0000-0000-000000000001'$$, '23503');
select tests.denied('task assignee cannot be a user from another workspace',
  $$update public.tasks set assignee_id = 'b0000000-0000-0000-0000-000000000002' where id = '3a000000-0000-0000-0000-000000000001'$$, '23503');
select tests.affects('member cannot edit a task in a project they do not belong to (row invisible)',
  $$update public.tasks set title = 'hacked' where id = '3a000000-0000-0000-0000-000000000002'$$, 0);
select tests.affects('member cannot edit another workspace''s task',
  $$update public.tasks set title = 'hacked' where id = '3b000000-0000-0000-0000-000000000001'$$, 0);
select tests.denied('member cannot move a task into a project they do not belong to (same workspace)',
  $$update public.tasks set project_id = '2a000000-0000-0000-0000-000000000002' where id = '3a000000-0000-0000-0000-000000000001'$$);
select tests.denied('member cannot move a task into another workspace''s project',
  $$update public.tasks set project_id = '2b000000-0000-0000-0000-000000000001' where id = '3a000000-0000-0000-0000-000000000001'$$);
select tests.denied('member cannot change a task''s workspace_id (column not writable)',
  $$update public.tasks set workspace_id = '1b000000-0000-0000-0000-000000000001' where id = '3a000000-0000-0000-0000-000000000001'$$);
select tests.denied('member cannot change created_by or id',
  $$update public.tasks set created_by = 'a0000000-0000-0000-0000-000000000001' where id = '3a000000-0000-0000-0000-000000000001'$$);
select tests.affects('member cannot delete tasks (admins only; rows invisible to delete)', 'delete from public.tasks', 0);

-- privilege escalation and membership tampering
select tests.affects('member cannot promote themselves (update is invisible to RLS)',
  $$update public.workspace_members set role = 'admin' where user_id = 'a0000000-0000-0000-0000-000000000002'$$, 0);
select tests.denied('member cannot add themselves to another workspace',
  $$insert into public.workspace_members (workspace_id, user_id, role)
    values ('1b000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002','member')$$);
select tests.denied('member cannot add a new workspace member as admin',
  $$insert into public.workspace_members (workspace_id, user_id, role)
    values ('1a000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','admin')$$);
select tests.denied('member cannot add themselves to another project',
  $$insert into public.project_members (project_id, workspace_id, user_id)
    values ('2a000000-0000-0000-0000-000000000002','1a000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002')$$);
select tests.affects('member cannot remove project members', 'delete from public.project_members', 0);
select tests.affects('member cannot remove workspace members', 'delete from public.workspace_members', 0);
select tests.denied('member cannot create a project',
  $$insert into public.projects (workspace_id, name) values ('1a000000-0000-0000-0000-000000000001','Mine')$$);
select tests.affects('member cannot rename a project',
  $$update public.projects set name = 'Renamed' where id = '2a000000-0000-0000-0000-000000000001'$$, 0);
select tests.affects('member cannot delete a project', 'delete from public.projects', 0);
select tests.affects('member cannot rename the workspace',
  $$update public.workspaces set name = 'Renamed'$$, 0);
select tests.denied('member cannot delete a workspace', 'delete from public.workspaces');
select tests.denied('member cannot change workspace_id/user_id of a membership (column not writable)',
  $$update public.workspace_members set user_id = 'c0000000-0000-0000-0000-000000000001'$$);

-- profiles
select tests.affects('member can edit their own display name',
  $$update public.profiles set display_name = 'Alpha One' where id = 'a0000000-0000-0000-0000-000000000002'$$, 1);
select tests.affects('member cannot edit someone else''s profile',
  $$update public.profiles set display_name = 'Nope' where id = 'a0000000-0000-0000-0000-000000000003'$$, 0);
select tests.denied('member cannot change their profile id',
  $$update public.profiles set id = gen_random_uuid() where id = 'a0000000-0000-0000-0000-000000000002'$$);
select tests.denied('member cannot insert profiles directly',
  $$insert into public.profiles (id, display_name) values (gen_random_uuid(), 'Fake')$$);

-- ---------------------------------------------------------------- member a3 (WA, no projects)
select tests.login('a0000000-0000-0000-0000-000000000004');
select tests.rows('workspace membership alone grants no projects', 'select * from public.projects', 0);
select tests.rows('workspace membership alone grants no tasks',    'select * from public.tasks', 0);
select tests.denied('workspace member without project access cannot create tasks',
  $$insert into public.tasks (workspace_id, project_id, title, due_date)
    values ('1a000000-0000-0000-0000-000000000001','2a000000-0000-0000-0000-000000000001','x',current_date)$$);

-- ---------------------------------------------------------------- admin of Alpha
select tests.login('a0000000-0000-0000-0000-000000000001');
select tests.rows('admin sees all workspace projects (not other workspaces)', 'select * from public.projects', 2);
select tests.rows('admin sees all workspace tasks without being a project member', 'select * from public.tasks', 3);
select tests.rows('admin sees all project memberships of their workspace', 'select * from public.project_members', 2);
select tests.rows('admin cannot see another workspace''s tasks',
  $$select * from public.tasks where workspace_id = '1b000000-0000-0000-0000-000000000001'$$, 0);
select tests.rows('admin cannot see another workspace''s members',
  $$select * from public.workspace_members where workspace_id = '1b000000-0000-0000-0000-000000000001'$$, 0);

select tests.allowed('admin can create a project',
  $$insert into public.projects (workspace_id, name, description) values ('1a000000-0000-0000-0000-000000000001','PA3','d')$$);
select tests.allowed('admin can rename a project',
  $$update public.projects set name = 'PA1 renamed' where id = '2a000000-0000-0000-0000-000000000001'$$);
select tests.denied('project names are unique per workspace',
  $$insert into public.projects (workspace_id, name) values ('1a000000-0000-0000-0000-000000000001','PA2')$$, '23505');
select tests.allowed('admin can rename the workspace',
  $$update public.workspaces set name = 'Workspace Alpha 2' where id = '1a000000-0000-0000-0000-000000000001'$$);
select tests.allowed('admin can add a project member who belongs to the workspace',
  $$insert into public.project_members (project_id, workspace_id, user_id)
    values ('2a000000-0000-0000-0000-000000000001','1a000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000004')$$);
select tests.allowed('admin can create a task in any workspace project',
  $$insert into public.tasks (workspace_id, project_id, title, assignee_id, due_date)
    values ('1a000000-0000-0000-0000-000000000001','2a000000-0000-0000-0000-000000000002','By admin','a0000000-0000-0000-0000-000000000003',current_date)$$);
select tests.denied('admin cannot assign a task to a workspace member outside the project',
  $$insert into public.tasks (workspace_id, project_id, title, assignee_id, due_date)
    values ('1a000000-0000-0000-0000-000000000001','2a000000-0000-0000-0000-000000000002','x','a0000000-0000-0000-0000-000000000002',current_date)$$, '23503');
select tests.allowed('admin can delete a task',
  $$delete from public.tasks where title = 'By admin'$$);

-- cross-workspace denials for an admin
select tests.denied('admin cannot create a project in another workspace',
  $$insert into public.projects (workspace_id, name) values ('1b000000-0000-0000-0000-000000000001','Sneaky')$$);
select tests.affects('admin cannot rename another workspace''s project',
  $$update public.projects set name = 'Sneaky' where id = '2b000000-0000-0000-0000-000000000001'$$, 0);
select tests.affects('admin cannot rename another workspace',
  $$update public.workspaces set name = 'Sneaky' where id = '1b000000-0000-0000-0000-000000000001'$$, 0);
select tests.denied('admin cannot add members to another workspace',
  $$insert into public.workspace_members (workspace_id, user_id, role)
    values ('1b000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','member')$$);
select tests.denied('admin cannot add project members in another workspace',
  $$insert into public.project_members (project_id, workspace_id, user_id)
    values ('2b000000-0000-0000-0000-000000000001','1b000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002')$$);
select tests.denied('admin cannot create a task in another workspace',
  $$insert into public.tasks (workspace_id, project_id, title, due_date)
    values ('1b000000-0000-0000-0000-000000000001','2b000000-0000-0000-0000-000000000001','x',current_date)$$);
select tests.affects('admin cannot delete another workspace''s task',
  $$delete from public.tasks where id = '3b000000-0000-0000-0000-000000000001'$$, 0);
select tests.denied('project membership requires workspace membership (user from another workspace)',
  $$insert into public.project_members (project_id, workspace_id, user_id)
    values ('2a000000-0000-0000-0000-000000000001','1a000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002')$$, '23503');
select tests.denied('project membership requires workspace membership (user with no workspace)',
  $$insert into public.project_members (project_id, workspace_id, user_id)
    values ('2a000000-0000-0000-0000-000000000001','1a000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001')$$, '23503');
select tests.denied('project membership workspace_id must match the project',
  $$insert into public.project_members (project_id, workspace_id, user_id)
    values ('2a000000-0000-0000-0000-000000000001','1b000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002')$$);

-- last-admin protection, then a proper hand-over (rolled back afterwards)
select tests.denied('the last admin cannot be demoted',
  $$update public.workspace_members set role = 'member' where user_id = 'a0000000-0000-0000-0000-000000000001'$$, 'P0001');
select tests.denied('the last admin cannot be removed',
  $$delete from public.workspace_members where user_id = 'a0000000-0000-0000-0000-000000000001'$$, 'P0001');
savepoint handover;
select tests.allowed('admin can promote another member', 
  $$update public.workspace_members set role = 'admin' where user_id = 'a0000000-0000-0000-0000-000000000004'$$);
select tests.allowed('once a second admin exists the first may step down',
  $$update public.workspace_members set role = 'member' where user_id = 'a0000000-0000-0000-0000-000000000001'$$);
select tests.rows('a demoted admin loses workspace-wide visibility', 'select * from public.projects', 0);
rollback to savepoint handover;

-- removing a project member unassigns their tasks instead of breaking them
select tests.login('a0000000-0000-0000-0000-000000000001');
savepoint unassign;
select tests.allowed('admin can remove a project member',
  $$delete from public.project_members where project_id = '2a000000-0000-0000-0000-000000000001' and user_id = 'a0000000-0000-0000-0000-000000000002'$$);
select tests.is_true('their task is kept but unassigned',
  $$select assignee_id is null from public.tasks where id = '3a000000-0000-0000-0000-000000000001'$$);
rollback to savepoint unassign;

-- an admin may grant a member a second project, after which tasks may move between them
select tests.login('a0000000-0000-0000-0000-000000000001');
savepoint move_ok;
select tests.allowed('admin adds a1 to PA2',
  $$insert into public.project_members (project_id, workspace_id, user_id)
    values ('2a000000-0000-0000-0000-000000000002','1a000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002')$$);
select tests.login('a0000000-0000-0000-0000-000000000002');
select tests.allowed('member can move a task between two projects they both belong to',
  $$update public.tasks set project_id = '2a000000-0000-0000-0000-000000000002' where id = '3a000000-0000-0000-0000-000000000001'$$);
rollback to savepoint move_ok;

-- ---------------------------------------------------------------- admin of Beta: mirror check
select tests.login('b0000000-0000-0000-0000-000000000001');
select tests.rows('Beta admin sees only Beta tasks', 'select * from public.tasks', 1);
select tests.rows('Beta admin sees only Beta projects', 'select * from public.projects', 1);
select tests.affects('Beta admin cannot edit an Alpha task',
  $$update public.tasks set title = 'hacked' where id = '3a000000-0000-0000-0000-000000000001'$$, 0);

-- ---------------------------------------------------------------- validation constraints (as table owner)
select tests.admin();
select tests.denied('blank task title is rejected',
  $$insert into public.tasks (workspace_id, project_id, title, due_date)
    values ('1a000000-0000-0000-0000-000000000001','2a000000-0000-0000-0000-000000000001','   ',current_date)$$, '23514');
select tests.denied('overlong task title is rejected',
  $$insert into public.tasks (workspace_id, project_id, title, due_date)
    values ('1a000000-0000-0000-0000-000000000001','2a000000-0000-0000-0000-000000000001',repeat('x',201),current_date)$$, '23514');
select tests.denied('invalid status is rejected',
  $$insert into public.tasks (workspace_id, project_id, title, status, due_date)
    values ('1a000000-0000-0000-0000-000000000001','2a000000-0000-0000-0000-000000000001','x','blocked',current_date)$$, '23514');
select tests.denied('invalid priority is rejected',
  $$insert into public.tasks (workspace_id, project_id, title, priority, due_date)
    values ('1a000000-0000-0000-0000-000000000001','2a000000-0000-0000-0000-000000000001','x','urgent',current_date)$$, '23514');
select tests.denied('due date is required',
  $$insert into public.tasks (workspace_id, project_id, title, due_date)
    values ('1a000000-0000-0000-0000-000000000001','2a000000-0000-0000-0000-000000000001','x',null)$$, '23502');
select tests.denied('invalid workspace role is rejected',
  $$update public.workspace_members set role = 'owner' where user_id = 'a0000000-0000-0000-0000-000000000002'$$, '23514');
select tests.denied('blank project name is rejected',
  $$insert into public.projects (workspace_id, name) values ('1a000000-0000-0000-0000-000000000001','  ')$$, '23514');
select tests.denied('task needs an existing project',
  $$insert into public.tasks (workspace_id, project_id, title, due_date)
    values ('1a000000-0000-0000-0000-000000000001',gen_random_uuid(),'x',current_date)$$, '23503');
select tests.allowed('deleting a whole workspace cascades cleanly (last-admin guard does not block it)',
  $$delete from public.workspaces where id = '1b000000-0000-0000-0000-000000000001'$$);
select tests.is_true('cascade removed the workspace''s projects, members and tasks',
  $$select (select count(*) from public.projects where workspace_id = '1b000000-0000-0000-0000-000000000001')
        + (select count(*) from public.tasks where workspace_id = '1b000000-0000-0000-0000-000000000001') = 0$$);

rollback;
