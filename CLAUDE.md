# CLAUDE.md — Nutrabay Task Manager

Internal task manager for ~100 employees (capacity not yet tested).
**Current stage: demonstration only.** Data is in memory and resets on refresh. Google login and shared database storage do **not** work yet; never word UI or docs as if they do.

## Stack
React 19 + TypeScript + Vite · Tailwind CSS v4 + shadcn/ui-style components (Radix primitives, `components.json` present) · React Router · Vitest + Testing Library · npm (commit `package-lock.json`) · Cloudflare Pages (static) · Supabase later (database + Google login).

## Commands
- `npm run dev` — local dev server
- `npm run typecheck` — `tsc -b --noEmit`
- `npm test` — Vitest, single run
- `npm run build` — type-check + production build into `dist/` (Cloudflare build command)

Before committing: typecheck, test and build must all pass.

## Architecture (layers; dependencies point downward)
| Layer | Path | Rule |
|---|---|---|
| Pages / routes | `src/pages`, `src/App.tsx` | Compose components; no data logic |
| UI components | `src/components/{ui,layout,tasks}` | Presentation + form state only. `ui/` = generic shadcn-style primitives |
| State | `src/state/TaskStore.tsx` | React context; talks only to a `TaskRepository` |
| Domain logic | `src/lib/tasks.ts` | **Pure functions**: validation, updates, filters, dashboard counts. Unit-tested. No React, no I/O |
| Data access | `src/data/` | `TaskRepository` interface, in-memory implementation, seed data, `createRepository()` factory |
| Types | `src/types` | Shared domain types and label maps |

Key points:
- Dashboard numbers are **derived** from the task list (`computeDashboardCounts`); never store counts.
- List and board views render the same filtered array from `TaskWorkspace`.
- My Tasks uses a "demo persona" selector. It is not authentication.
- Seed due dates are relative to today so the demo stays current.
- Routing: `public/_redirects` (`/* /index.html 200`) makes nested routes (e.g. `/projects/p-hr`) work on direct open/refresh on Cloudflare Pages.

## Supabase integration plan
1. Add a `SupabaseTaskRepository` in `src/data/` implementing `TaskRepository`.
2. Select it in `createRepository()` when `readSupabaseConfig()` returns a value; otherwise keep the in-memory demo.
3. Replace the demo persona with the signed-in user (Google OAuth through Supabase Auth); remove the demo banner only once data is really shared.
4. Enforce access with Row Level Security — the browser is untrusted.

## Database (supabase/)
- `supabase/migrations/` — SQL migrations, applied manually in the Supabase SQL Editor. Not connected to the app yet; the demo stays in memory.
- Permissions live in PostgreSQL: explicit grants + RLS + constraints. Model documented in `supabase/README.md`. Frontend checks are never the security boundary.
- Any change to tables, policies or grants needs: a **new** migration file (never edit an applied one), updated tests in `supabase/tests/`, and `npm run test:db` green (needs local PostgreSQL).
- Never run tests or scripts against the hosted project; never commit keys. The first admin is provisioned manually (`supabase/provisioning/first_admin.sql`), never by first sign-up.

## Working rules
- Work on a feature branch; never push to `main` directly.
- **No secrets in browser code.** Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` may exist as `VITE_*` vars (see `.env.example`, which stays empty). Never use a service-role key client-side. Never commit `.env*` other than `.env.example`.
- The app must work with those variables missing.
- No AI API calls and no paid services without explicit approval.
- Fictional employee names only in demo data; no real personal data.
- Keep domain logic in `src/lib` with tests; change behavior → change/add tests.
- Accessibility: every control has a label, errors are linked with `aria-describedby`, interactive elements are keyboard reachable, status is never conveyed by color alone.
- Prefer small, typed, dependency-light changes. Keep `package-lock.json` in sync (`npm install`, not hand-edits).
