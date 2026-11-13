# Hand-off: project status and infrastructure

Read this before working on qulearn. It records where everything lives, what is
finished, what is open, and decisions that are not visible in the code.
Architecture and coding rules are in [../AGENTS.md](../AGENTS.md); setup in [../README.md](../README.md).

**Keep this file current.** When you change infrastructure, finish an open item or make a decision
the next person needs, update the relevant section in the same commit.

> This repository is **public**. Never commit connection strings, passwords, tokens or `.env`.
> Credentials live in the local `.env` (gitignored) and in the hosting provider's settings.

_Last updated: 2026-11-14._

## 1. What this is

A rewrite of the original vanilla-JS + Supabase app (kept unchanged in `legacy/`) as Next.js 16 +
TypeScript + Prisma/PostgreSQL + shadcn/ui. Arabic, RTL. Every legacy section has been ported.

- GitHub: `ismusamim/qulearn` (public). Work branch: **`rewrite/next-prisma`**, not yet merged into `main`.
- `main` still contains only the old app, and the live domain still serves it.

## 2. Infrastructure

| What | Where | Notes |
|---|---|---|
| Database | **Neon**, project `qulearn` (id `lingering-boat-23811932`), branch `main`, region `aws-eu-central-1` (Frankfurt), Postgres 17 | Holds the schema (3 migrations) and the demo seed only. No real data yet. |
| Local database | Docker container `qulearn-db` on port 55470 (`docker-compose.yml`) | For offline work; same schema. |
| Hosting (chosen) | **Vercel**, project `qulearn` in the repo owner's team `zoha17`; production domain `qurlearn.vercel.app` (still the old app) | Connected to GitHub: every push builds. Framework preset **Next.js**, Node 26.x. `DATABASE_URL` and `DATABASE_URL_UNPOOLED` are set for Production, Preview and Development. Branch previews: `https://qulearn-git-<branch>-zoha17.vercel.app`. Vercel Authentication on previews is turned off. |
| Vercel CLI access to `zoha17` | On the developer's laptop, a separate login: `vercel … --global-config ~/.vercel-zoha --scope zoha17` (approved by the owner via device login) | Lets an agent read logs, manage env vars and redeploy. Revocable by the owner at vercel.com/account/settings/tokens. |
| Netlify (abandoned) | site `qulearn-halaqat` → https://qulearn-halaqat.netlify.app, team `salah-nb-03` | Works from abroad but is **unreachable from the developer's network in Egypt**, and the free plan runs functions in Ohio (far from the Frankfurt DB). Not used. Safe to delete. |
| Vercel (developer's account) | team `salaheldins-projects` | **Blocked by Vercel for exceeding fair-use limits** — cannot create projects. Do not use. |

Environment variables (both required, everywhere the app runs):

| Name | Value |
|---|---|
| `DATABASE_URL` | Neon **pooled** string (host contains `-pooler`) — used by the app |
| `DATABASE_URL_UNPOOLED` | Neon **direct** string — used by Prisma Migrate (`prisma.config.ts`) |

Use `sslmode=verify-full` in both. Get them with `neon env pull -e DATABASE_URL,DATABASE_URL_UNPOOLED --file .env`
(Neon CLI logged in to the developer's org) or from the Neon console.

Migrations never run during a build. Apply them with `npm run db:deploy` from a machine that has the direct URL.

## 3. Status

Done and verified:

- Typecheck, lint, 233 unit tests (`npm test`), production build.
- Browser tests (`e2e/`) against the local server and against Neon: every menu page for all five roles
  loads without errors; marking attendance, recording a recitation, creating a place, wrong-password
  refusal, login lockout, and access control (non-admins redirected, backup export refused) all pass.
- Database: indexes from real query patterns, 18 CHECK constraints, pg_trgm search; benchmarked on
  1.25M attendance / 750k recitation rows (see the `db_optimizations` migration and README).
- The old app's offline service worker is retired by `public/sw.js` (tested in a browser).

Not verified in a browser (unit tests only): payroll editing, fees and collections, exams, the import
screens, settings and permissions editing. Click through these before go-live.

## 4. Go-live checklist (in this order)

1. Test the Vercel preview of `rewrite/next-prisma` — especially the unverified sections in §3.
2. **Before the live domain switches**, the administrator exports the JSON backup from the **old** app.
   After the switch the old app is gone and its data can only come from that file (or Supabase).
3. Import it in the new app: «الاستيراد والبيانات» → «نسخة احتياطية». Hosted uploads are capped at
   about 4.4 MB; import larger files from a local copy (`npm run build && npm start` with the Neon `.env`).
4. Change or delete the demo accounts (`المدير` / `1234`, others `0000`) — the database is internet-reachable.
5. Merge `rewrite/next-prisma` into `main` and point the live domain at the chosen host.
6. Keep `public/sw.js` for a few months.

## 5. Open decisions and known issues

- **Hosting history.** Netlify was tried and dropped (unreachable from Egypt, functions in Ohio).
  The developer's own Vercel team is blocked for fair use. Vercel `zoha17` is the host.
- **Vercel region.** `vercel.json` pins functions to Frankfurt (`fra1`), next to the Neon database.
  The project default was `iad1` (Washington). Keep the two in the same region.
- **Pushing to `main` before the merge breaks deploys.** The Vercel project is now set to Next.js, so a
  build of the old app on `main` fails (the live site keeps its last good version). Merge the rewrite first.
- **Git push from the developer's laptop:** HTTPS has no stored credentials and the SSH key is not
  registered on GitHub. Push with the GitHub CLI login without changing git config:
  `git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push`.
- **`npm run dev` on the developer's laptop** fails with "OS file watch limit reached" (inotify limits).
  Fix needs sudo: raise `fs.inotify.max_user_watches` / `max_user_instances`. `npm run build && npm start` works meanwhile.
- `Collection` has a unique key that includes the nullable `halaqaId`; Postgres allows duplicates when it
  is NULL (only after a halaqa is deleted). Low impact.
- `Member` has no database-level uniqueness on (role, name); the services enforce it.

## 6. Decisions already made (do not re-litigate without the owner)

- One Next.js app for frontend and backend; no separate API server.
- No offline mode (the legacy PWA is retired).
- Passwords are bcrypt hashes and can only be reset, never shown again.
- A student marked «منقطع» cannot get new attendance or recitation records (stricter than legacy).
- Student list pages by 50 instead of "first 300".
- Deleting members or students asks for the admin's own password.
- Name search suggestions on the login page never include administrators.

## 7. How to verify a change

```bash
npm run typecheck && npm run lint && npm test
npm run build && npm start                      # http://localhost:3000
BASE_URL=http://localhost:3000 node e2e/smoke.mjs    # read-only: every page, every role
BASE_URL=http://localhost:3000 node e2e/flows.mjs    # WRITES test data — local database only
```

The e2e scripts need Chrome (`CHROME_PATH`, default `/usr/bin/google-chrome`) and the demo accounts.
