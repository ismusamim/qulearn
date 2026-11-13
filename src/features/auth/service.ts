import "server-only";

import { normalizeArabic } from "@/lib/arabic";
import { type Role, ROLES } from "@/lib/constants";
import { homeFor } from "@/lib/navigation";
import { resolvePermissions } from "@/lib/permissions";
import type { AuthContext } from "@/server/auth";
import { verifyPassword } from "@/server/auth/password";
import { createSession, destroySession } from "@/server/auth/session";
import { db } from "@/server/db";
import { AppError, ForbiddenError } from "@/server/errors";
import { getSettings } from "@/server/settings";

import type { LoginInput, SwitchAccountInput } from "./schemas";

export interface LoginNameMatch {
  name: string;
  /** One entry per role this name can log in as. */
  accounts: { memberId: string; role: Role }[];
}

const BAD_CREDENTIALS = "الاسم أو كلمة المرور غير صحيحة";

// ───────────── Throttling of failed logins ─────────────
// Stored in the database (login_throttles), so the lockout survives restarts
// and holds across several server instances. Keyed by the normalised name,
// which is what an attacker guessing a 6-digit password has to repeat.

const MAX_FAILURES = 5;
const LOCK_MS = 60_000;
/** Counters untouched for this long are forgotten (cleaned up opportunistically). */
const FORGET_MS = 24 * 60 * 60 * 1000;

async function assertNotLocked(key: string): Promise<void> {
  const row = await db.loginThrottle.findUnique({ where: { key }, select: { lockedUntil: true } });
  if (row?.lockedUntil && row.lockedUntil > new Date()) {
    throw new AppError("محاولات كثيرة خاطئة، انتظر دقيقة ثم حاول مرة أخرى");
  }
}

async function recordFailure(key: string): Promise<void> {
  // Atomic increment; the lock starts on the MAX_FAILURES-th failure and the counter restarts.
  const row = await db.loginThrottle.upsert({
    where: { key },
    create: { key, failures: 1 },
    update: { failures: { increment: 1 } },
    select: { failures: true },
  });
  if (row.failures >= MAX_FAILURES) {
    await db.loginThrottle.update({
      where: { key },
      data: { failures: 0, lockedUntil: new Date(Date.now() + LOCK_MS) },
    });
  }
}

async function clearFailures(key: string): Promise<void> {
  await db.loginThrottle.deleteMany({
    where: { OR: [{ key }, { updatedAt: { lt: new Date(Date.now() - FORGET_MS) } }] },
  });
}

// ───────────── Login page ─────────────

/**
 * Name suggestions for the login page. Returns names and account types only —
 * never the halaqa or place — and never lists administrators (an admin types
 * their full name). Needs at least two letters.
 */
export async function searchLoginNames(query: string): Promise<LoginNameMatch[]> {
  const { publicNameSearch } = await getSettings();
  if (!publicNameSearch) return [];
  const q = normalizeArabic(query);
  if (q.length < 2) return [];

  const members = await db.member.findMany({
    where: { role: { not: "ADMIN" }, passwordHash: { not: null }, nameNormalized: { contains: q } },
    select: { id: true, name: true, nameNormalized: true, role: true },
    orderBy: { name: "asc" },
    take: 60,
  });

  const groups = new Map<string, LoginNameMatch>();
  for (const m of members) {
    const group = groups.get(m.nameNormalized) ?? { name: m.name, accounts: [] };
    group.accounts.push({ memberId: m.id, role: m.role });
    groups.set(m.nameNormalized, group);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => Number(b.startsWith(q)) - Number(a.startsWith(q)))
    .slice(0, 8)
    .map(([, group]) => ({
      ...group,
      accounts: group.accounts.sort((x, y) => ROLES.indexOf(x.role) - ROLES.indexOf(y.role)),
    }));
}

/** Verifies the credentials, opens a session and returns the page to land on. */
export async function login(input: LoginInput): Promise<{ redirectTo: string }> {
  const nameKey = normalizeArabic(input.name);
  await assertNotLocked(nameKey);

  // A picked suggestion names one account; a typed name may match several
  // (same person, different roles) and the password decides which one.
  const candidates = await db.member.findMany({
    where: input.memberId
      ? { id: input.memberId, passwordHash: { not: null } }
      : { nameNormalized: nameKey, passwordHash: { not: null } },
    select: {
      id: true,
      role: true,
      passwordHash: true,
      permissions: { select: { permission: true, allowed: true } },
    },
  });

  for (const member of candidates) {
    if (await verifyPassword(input.password, member.passwordHash)) {
      await clearFailures(nameKey);
      await createSession(member.id);
      const roleSettings = await db.rolePermission.findMany({
        where: { role: member.role },
        select: { permission: true, allowed: true },
      });
      const permissions = resolvePermissions(member.role, roleSettings, member.permissions);
      return { redirectTo: homeFor(member.role, permissions) };
    }
  }
  await recordFailure(nameKey);
  throw new AppError(BAD_CREDENTIALS);
}

export async function logout(): Promise<void> {
  await destroySession();
}

// ───────────── Switching between a person's accounts ─────────────

/** The same person's other accounts (same name, different role), e.g. teacher ↔ student. */
export async function listSwitchTargets(auth: AuthContext): Promise<{ memberId: string; role: Role }[]> {
  const others = await db.member.findMany({
    where: { nameNormalized: auth.nameNormalized, id: { not: auth.memberId }, passwordHash: { not: null } },
    select: { id: true, role: true },
  });
  return others.map((m) => ({ memberId: m.id, role: m.role }));
}

export async function switchAccount(auth: AuthContext, input: SwitchAccountInput): Promise<{ redirectTo: string }> {
  // Only accounts carrying the caller's own name are reachable this way.
  const target = await db.member.findFirst({
    where: { id: input.memberId, nameNormalized: auth.nameNormalized },
    select: { id: true, name: true },
  });
  if (!target || target.id === auth.memberId) throw new ForbiddenError();
  // login() throws on a wrong password, leaving the current session untouched.
  const result = await login({ name: target.name, memberId: target.id, password: input.password });
  await db.session.deleteMany({ where: { id: auth.sessionId } });
  return result;
}
