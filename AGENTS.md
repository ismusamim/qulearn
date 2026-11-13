<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# qulearn — architecture and rules

> **Start with [docs/HANDOFF.md](docs/HANDOFF.md)**: current status, where the database and hosting live,
> open issues and decisions already made. Update it whenever you change any of those.

Arabic (RTL) web app for managing Quran halaqat. Next.js 16 App Router + TypeScript (strict) + Prisma 7 / PostgreSQL + shadcn/ui (radix, Tailwind 4).
`legacy/` holds the original vanilla-JS + Supabase app. It is the **functional specification** for the rewrite (read it for behaviour, wording and business rules); never import from it and never edit it.

## Layers (dependencies point downwards only)

```
src/app/**            Routes. Thin: guard → call service → render feature components. No Prisma, no business rules.
src/features/<name>/  One folder per business area:
    schemas.ts        Zod input schemas + inferred types. Shared by client forms and server actions. No server imports.
    service.ts        "server-only". ALL business rules, authorisation and Prisma access. Takes AuthContext first,
                      returns plain DTOs (interfaces declared here). Throws AppError subclasses.
    actions.ts        "use server". One thin function per mutation: runAction(schema, input, handler) → service → revalidatePath.
    components/       UI for the feature (server components by default; "use client" only where interactive).
    *.ts / *.test.ts  Pure domain logic local to the feature, with unit tests.
src/lib/              Pure, isomorphic helpers (no DB, no next/headers): arabic, dates, format, constants, quran,
                      permissions, navigation, theme, domain/* (halaqa naming, fee due, national ID).
src/server/           Server-only infrastructure: db (Prisma client), auth/* (session, guards, scope), action runner,
                      members (createMemberRecord / resetMemberPassword — the only way to create accounts),
                      errors, settings, directory (shared read-only lookups for dropdowns/labels).
src/components/ui/    shadcn components (vendored; do not edit). src/components/shared/ — app-wide building blocks.
```

Reference implementation to copy: `src/features/places/*` and `src/app/(app)/halaqat/page.tsx`.

## Rules

1. **Authorisation lives in services.** Every exported service function takes `auth: AuthContext` and checks access itself
   (`assertRole`, `assertCan`, `assertCanTeachStudent`, `managedHalaqaWhere`, … from `@/server/auth`). Pages also guard with
   `requirePage(...)`, but that is UX only — server actions are public HTTP endpoints. Never trust the client for ids,
   names of "who did it", amounts already computed, or role.
2. **Server actions** always go through `runAction` / `runSimpleAction` (`@/server/action`) and return `ActionResult<T>`.
   Never throw to the client. Client components call them with the `useAction` hook (`@/hooks/use-action`).
3. **Validation**: one Zod schema per input in `schemas.ts`, Arabic error messages. Zod 4 (`z.uuid()`, `z.email()`,
   `{ error: "..." }` or a string message). Forms use react-hook-form + `zodResolver` + shadcn `Field` components.
4. **DTOs, not models.** Never pass Prisma objects to client components: map to plain objects. `Decimal` → `number`
   (`Number(x)`), `@db.Date` → ISO string via `toISODate` / `fromISODate` (`@/lib/dates`). Import enum *types* for client
   code from `@/lib/constants` or declare string unions; import Prisma types only in server code
   (`@/generated/prisma/client`).
5. **Errors**: throw `ForbiddenError`, `NotFoundError`, `ConflictError`, `ValidationError` (`@/server/errors`) with a
   user-facing Arabic message. Multi-step writes use `db.$transaction`.
6. **Names**: store `name` through `fixName()` and always set `nameNormalized: normalizeArabic(name)` on Member.
   Phones through `normalizePhone()`. Search with `normalizeArabic`.
7. **UI**: Arabic text, RTL. Use logical Tailwind classes (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`),
   never `ml/mr/left/right`. Use shadcn components from `@/components/ui/*`, lucide icons, `PageHeader`, `EmptyState`,
   `ConfirmDialog`, `PrintButton` from `@/components/shared/*`, toasts via `sonner`. Colours come from theme tokens
   (`bg-primary`, `text-muted-foreground`, `text-destructive`, `bg-success`, `text-warning`, `border-gold`) — no hex in
   components. Numbers, phones, dates and passwords get `dir="ltr"`. Mark non-printable UI with `no-print`.
8. **Pages** are async server components: `const auth = await requirePage((a) => ...)`, fetch through services, render.
   Filters/tabs that should survive reload go in `searchParams` (a Promise in Next 16: `await props.searchParams`).
   `export const metadata = { title: "…" }` on every page.
9. **No new dependencies, no schema edits, no edits to shared files** (`src/lib`, `src/server`, `src/components/shared`,
   `src/components/layout`, `prisma/`, config) without coordinating — other work depends on them. If something is
   missing, add it inside your own feature folder and report it.
10. Keep files focused (aim < 300 lines); split big components. Comments explain *why* (business rules), in English.
    Pure calculations (salary, fee due, exam score…) go in their own module with Vitest tests.

## Domain notes

- One `Member` per (person, role). Roles: ADMIN, SUPERVISOR, TEACHER, STUDENT, ACCOUNTANT. Students have a
  `StudentProfile`, teachers a `TeacherProfile` (create it together with the member).
- Passwords are bcrypt-hashed (`@/server/auth/password`); a generated 6-digit password can be shown to the admin only
  once, at creation/reset time.
- Grantable permissions are listed in `src/lib/permissions.ts`; admins hold all. Check with `can(auth, "fees.collect")`.
- Blocked accounts (student DROPPED, teacher SUSPENDED) cannot write: `runAction` enforces this.
- Halaqa display name: `listAllHalaqaOptions()` / `halaqaLabelMap()` from `@/server/directory` (never `halaqa.name` directly).
- Settings (org name, logo, theme, block messages) only through `@/server/settings`.

## Commands

```
# Database: Neon project "qulearn" (see README). .env holds DATABASE_URL (pooled, app) and
# DATABASE_URL_UNPOOLED (direct, migrations). Never run migrations through the pooled URL.
npm run db:up        # local PostgreSQL in Docker, for offline work only
npm run db:migrate   # create + apply a migration (dev). Raw SQL (CHECKs, extensions) goes into the generated file.
npm run db:deploy    # apply pending migrations (Neon main / production)
npm run db:seed      # demo data (admin «المدير» / 1234, others 0000)
npm run dev          # http://localhost:3000
npm run typecheck && npm run lint && npm test
```
