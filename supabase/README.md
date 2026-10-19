# Supabase database foundation

Files:
- `migrations/20260930000000_database_foundation.sql` — **the migration to review and apply** (once).
- `provisioning/first_admin.sql` — manual, one-time script for the first workspace + admin.
- `tests/` — permission tests that run against a throwaway **local** PostgreSQL (never Supabase).

The React demo does not use any of this yet; it still runs in memory.

## Identity
`profiles.id` = `auth.users.id` (Supabase Auth). A trigger creates a profile for every new Auth user. A profile carries **no** access: a brand-new sign-up sees nothing and is never an admin.

## Tables
| Table | Purpose |
|---|---|
| `workspaces` | Top-level tenant |
| `profiles` | One per Auth user (display name only; no email stored) |
| `workspace_members` | (workspace, user, role `admin`\|`member`) |
| `projects` | Belong to a workspace; unique name per workspace |
| `project_members` | Explicit project access; composite FK forces the user to be a workspace member |
| `tasks` | title, description, one assignee, priority, status, due date; composite FKs force project↔workspace agreement and **assignee ∈ project** |

## Permission model
| Actor | Can |
|---|---|
| `anon` (not signed in) | Nothing. No grants on any table or on the `private` schema. |
| Signed in, no membership | See only their own profile. Edit their own display name. |
| Workspace **member** | Read their workspace, its roster and the profiles of co-members. Read **only projects they belong to**, those projects' rosters and tasks. **Create and edit tasks only in those projects** (assignee must be a project member). Edit own display name. |
| Workspace **admin** | Everything a member can do, for **all** projects of **their** workspace, plus: create/rename/delete projects, add/remove/promote/demote workspace members, add/remove project members, delete tasks, rename the workspace. |
| Nobody via the API | Create/delete workspaces, create profiles, touch another workspace, edit id/ownership/timestamp columns (`workspace_id`, `created_by`, `created_at`, `updated_at`), or remove/demote the last admin of a workspace (also under concurrent requests). |

How it is enforced (all in PostgreSQL):
1. **Grants** — `anon` none; `authenticated` only SELECT plus *column-level* INSERT/UPDATE and DELETE where needed. Tables were never auto-exposed; the migration revokes everything first.
2. **RLS** on all six tables, using `security definer` helpers in the unexposed `private` schema (`is_workspace_admin`, `has_project_access`, …) to avoid recursive policies.
3. **Constraints** — composite foreign keys, CHECKs, NOT NULLs, unique names.
4. **Triggers** — `updated_at`, last-admin guard, profile creation on sign-up. The last-admin guard locks the workspace row, then re-reads the other admins, so simultaneous demotions/removals are serialized and one of them is refused.

Notes:
- Denied `UPDATE`/`DELETE` on rows you cannot see affect **0 rows** (no error); denied `INSERT` or writes to non-granted columns raise `42501`.
- Removing someone from a project leaves their tasks, unassigned (`assignee_id` becomes NULL).
- Deleting an Auth user who is a workspace's only admin is blocked until another admin exists.
- Admin demotion/removal needs the default `READ COMMITTED` isolation (what Supabase uses); `REPEATABLE READ`/`SERIALIZABLE` are refused so the guard can never act on a stale snapshot. Deleting a whole workspace works at any level.
- In rare cases an admin change racing a whole-workspace delete can hit a PostgreSQL deadlock; one statement is aborted and can simply be retried.
- Anyone who can sign up to Auth still gets a profile. Restrict sign-ups (company Google domain / invite-only) in the Auth settings when login is added.

## Running the tests
Needs a local PostgreSQL 15+ superuser (no password), e.g. on Linux:
```bash
su postgres -c "bash supabase/tests/run.sh"     # or: npm run test:db  (if your user can connect)
```
`10_permissions.sql` runs in one rolled-back transaction. `20_concurrency.sh` opens several independent `psql` connections (committed data) and checks that simultaneous admin demotions/removals block, are re-checked after the lock, and always leave at least one admin; it also stress-races 2-3 sessions.

`tests/00_supabase_shim.sql` fakes `auth.uid()`, `auth.users` and the `anon`/`authenticated` roles. The script refuses non-local hosts and `DATABASE_URL`, creates and drops a scratch database, and prints `ok - …` for each assertion.
