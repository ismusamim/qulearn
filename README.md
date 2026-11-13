# إدارة حلقات تحفيظ القرآن — qulearn

تطبيق ويب عربي (RTL) لإدارة حلقات التحفيظ: الأعضاء والحلقات، الحضور والتسميع، الاختبارات، الاشتراكات وتحصيل المعلمين، المرتبات وغياب المعلمين، الإعلانات والصلاحيات.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Server Components, Server Actions) + React 19 |
| Language | TypeScript (strict) |
| Database | PostgreSQL 17 on [Neon](https://neon.com) (Frankfurt) + Prisma ORM 7; Docker Postgres for offline work |
| UI | shadcn/ui (Radix) + Tailwind CSS 4, RTL |
| Validation | Zod 4 + react-hook-form |
| Auth | Name + password, bcrypt hashes, database-backed sessions in an httpOnly cookie |
| Tests | Vitest |

## Getting started

Requires Node.js 20.19+.

### With the Neon database (default)

The database is the Neon project **qulearn** (`lingering-boat-23811932`, branch `main`, region `aws-eu-central-1`).
With the Neon CLI logged in, `neon env pull` writes both connection strings into `.env`:

```bash
npm install                                        # also generates the Prisma client
neon env pull -e DATABASE_URL,DATABASE_URL_UNPOOLED --file .env
npm run dev                                        # http://localhost:3000
```

`DATABASE_URL` is the **pooled** string (host ends in `-pooler`), used by the app.
`DATABASE_URL_UNPOOLED` is the **direct** string, used by Prisma Migrate, which cannot run through the pooler
([prisma.config.ts](prisma.config.ts)). Use `sslmode=verify-full` in both.

### With a local Docker database (offline)

```bash
cp .env.example .env     # both URLs point at the container
npm run db:up            # start PostgreSQL in Docker (port 55470)
npm run db:migrate       # create the tables
npm run db:seed          # demo accounts and data
npm run dev
```

Demo accounts after seeding — both databases are seeded. **Change these passwords (or delete the demo accounts) from «الأعضاء» before real data goes in:**

| الاسم | النوع | كلمة المرور |
|---|---|---|
| المدير | مدير | `1234` |
| الشيخ أحمد | معلم | `0000` |
| المشرف خالد | مشرف | `0000` |
| المحاسب سعيد | محاسب | `0000` |
| عبد الله / محمد / يوسف | طلاب | `0000` |

The administrator is never suggested on the login page: type the full name «المدير».

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Development server / production build / run the build |
| `npm run typecheck` · `npm run lint` · `npm test` | Static checks and unit tests |
| `npm run db:up` | Start the local PostgreSQL container |
| `npm run db:migrate` | Development: create a migration from schema changes and apply it |
| `npm run db:deploy` | Apply pending migrations only (production / Neon `main`) |
| `npm run db:seed` | Insert demo data into an empty database |
| `npm run db:studio` | Browse the data with Prisma Studio |

## Project structure

```
prisma/                 schema.prisma, migrations, seed
src/app/                routes — thin pages that guard, call a service and render
src/features/<name>/    one folder per business area: schemas.ts (Zod), service.ts (rules,
                        authorisation, data access), actions.ts (server actions), components/
src/lib/                pure helpers shared by client and server (Arabic text, dates, permissions,
                        navigation, domain calculations)
src/server/             server-only infrastructure: Prisma client, sessions, guards, action runner
src/components/ui/      shadcn/ui components      src/components/shared/  app-wide building blocks
legacy/                 the original vanilla-JS + Supabase app, kept as the functional reference
```

The architecture rules are in [AGENTS.md](AGENTS.md).

## Moving data from the old app

1. **Before** the new app replaces the old one on the live domain, open the old app as administrator and export its
   JSON backup (the old app is unreachable once the domain points at the new one).
2. Sign in to the new app as the administrator → «الاستيراد والبيانات» → «نسخة احتياطية» → import the file.
   Passwords are hashed during the import.
3. Vercel refuses uploads over 4.5 MB. For a larger backup (many photos), run the app locally against the same
   database — `npm run build && npm start` with the Neon `.env` — and import at http://localhost:3000.

## Deployment (Vercel)

Project settings:

| Setting | Value |
|---|---|
| Framework Preset | **Next.js** (the old app used «Other») |
| Build / Output / Install commands | defaults (leave empty) |
| Node.js version | 22.x or 24.x |
| Environment variables | `DATABASE_URL` (Neon **pooled**) and `DATABASE_URL_UNPOOLED` (Neon **direct**) |

Migrations are not run by the build (preview deployments share the database). Apply them once per release
from a machine with the direct URL: `npm run db:deploy`.

The old app's offline service worker is retired automatically by [public/sw.js](public/sw.js) the next time each
browser visits; keep that file for a few months.

## Database design notes

- **Indexes** follow the real query patterns (see the comments in [prisma/schema.prisma](prisma/schema.prisma)), including a
  trigram (`pg_trgm`) index for substring name search.
- **CHECK constraints** (months 1–12, surah 1–114, ayah ranges, juz 1–30, non-negative money, percentages ≤ 100) are
  added in raw SQL in the `db_optimizations` migration, because Prisma cannot model them. They mirror the Zod rules.
- **Timestamps**: mutable business tables carry `created_at` / `updated_at`.
- **Housekeeping**: expired sessions are deleted on each login; failed-login lockouts live in `login_throttles`.
- **Schema changes on Neon**: test a migration on a branch first —
  `neon branches create --name migration-test`, point `DATABASE_URL_UNPOOLED` at it, run `npm run db:deploy`,
  then apply to `main`.

