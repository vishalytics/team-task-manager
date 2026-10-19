# Setup & Deployment

> This is a **demonstration build**. Tasks live in browser memory and reset on refresh. There is no login and no shared database yet.

## Requirements
- Node.js 20.19+ or 22+ (developed on 22) and npm

## Run locally
```bash
npm ci            # installs exactly what package-lock.json specifies
npm run dev       # http://localhost:5173
```

## Checks
```bash
npm run typecheck   # TypeScript
npm test            # unit + UI tests
npm run build       # type-check + production build -> dist/
npm run preview     # serve dist/ locally (http://localhost:4173)
```

## Environment variables (optional)
Copy `.env.example` to `.env.local` if needed. Both values are empty by default and **the demo works without them**; they are not used yet.

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL (future) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) key (future) |

Never put a service-role key or other secret in any `VITE_*` variable — they are public in the built JavaScript.

## Deploy to Cloudflare Pages
1. Cloudflare dashboard → Workers & Pages → Create → Pages → connect the GitHub repo.
2. Settings:
   - Framework preset: None (or Vite)
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Node version: set env var `NODE_VERSION=22`
3. Deploy. Every push builds a preview; the production branch deploys to production.

**Nested routes:** `public/_redirects` is copied into `dist/` and rewrites every path to `index.html`, so opening or refreshing e.g. `/projects/p-hr` works.

### Netlify
The demo also deploys on Netlify with the same settings: build command `npm run build`, publish directory `dist`. Netlify reads the same `public/_redirects` file, so nested routes keep working.

## Database (Supabase) — migration only

The SQL below only **prepares** the database. The React app does not use it yet and still runs in memory. Read `supabase/README.md` for the permission model first.

**Migration to review and apply:** `supabase/migrations/20260930000000_database_foundation.sql`

### 1. Apply the migration (once)
1. Review the file. Apply it to `nutrabay-tasks-dev` first, never to anything else by accident.
2. Supabase dashboard → project **nutrabay-tasks-dev** → **SQL Editor** → **New query**.
3. Paste the whole file and click **Run**. It runs in one transaction: it either fully applies or changes nothing. You should see "Success. No rows returned".
4. Do **not** run it twice. A second run errors on purpose ("already exists") instead of altering security objects. If something failed halfway, nothing was applied; fix and re-run.

### 2. Verify it (SQL Editor, new query each)
a) All six tables exist with RLS on — expect 6 rows, `rls_enabled = true`:
```sql
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relname in ('workspaces','profiles','workspace_members','projects','project_members','tasks')
order by 1;
```
b) The public (not-signed-in) role has no access — expect **0 rows**:
```sql
select table_name, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'PUBLIC');
```
c) Signed-out access is refused — expect the error `permission denied for table tasks`:
```sql
begin;
set local role anon;
select * from public.tasks;
rollback;
```
d) A signed-in user with no workspace sees nothing — expect `0`:
```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}', true);
select count(*) from public.tasks;
rollback;
```
e) Policies exist — expect exactly 19 rows: `select tablename, policyname, cmd from pg_policies where schemaname = 'public' order by 1, 2;`

If (b) returns rows or (c)/(d) do not behave as stated, **stop and do not add users**.

### 3. Provision the first workspace admin (manual, secure)
Nothing in the app or API can create a workspace or an admin, and the first person to sign up is **never** made admin. A human with dashboard access does this once:
1. Have the intended admin sign in. Until the app has login, use **Authentication → Users → Invite user** (they accept the email invite and set their own password — you never handle it). Once Google login is added later, signing in with Google works too.
2. **Authentication → Users**: check the email is exactly the expected person and copy their **User UID**.
3. **SQL Editor**: open `supabase/provisioning/first_admin.sql`, replace `PASTE-USER-UUID-HERE` (and the workspace name if desired), **Run**. It refuses to run if the user or profile does not exist or the workspace already exists.
4. Verify: `select * from public.workspace_members;` shows one row with role `admin`.

Further people: they sign in first, then a workspace admin adds them (for now via SQL Editor; later via the app).

### 4. Run the database permission tests (local only)
These run against a **throwaway local PostgreSQL**, never your Supabase project:
```bash
su postgres -c "bash supabase/tests/run.sh"     # prints ok - ... per check, then the totals (permission tests, then multi-connection concurrency tests)
```
(`npm run test:db` does the same if your shell user can connect to a local superuser role.)

### Secrets
Never paste passwords, the `service_role` key, or the database password into the repo, chat, or any `VITE_*` variable. Only the project URL and publishable key ever go in `.env.local`.

## Not included yet
Google login, connecting the app to Supabase, admin UI for members, and load/capacity testing for 100 users.
