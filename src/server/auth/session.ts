import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";

import { cookies } from "next/headers";

import type { Role } from "@/lib/constants";
import { db } from "@/server/db";

import { type PermissionKey, resolvePermissions } from "@/lib/permissions";

export const SESSION_COOKIE = "qulearn_session";
const SESSION_DAYS = 30;

/**
 * Who is making the request. Built once per request by `getAuth()` and passed
 * explicitly to every service function.
 */
export interface AuthContext {
  sessionId: string;
  memberId: string;
  role: Role;
  name: string;
  nameNormalized: string;
  permissions: ReadonlySet<PermissionKey>;
  /** Dropped students and suspended teachers may log in but see only a notice and cannot write. */
  blocked: boolean;
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Creates a session row and sets the cookie. Only the token's hash is stored. */
export async function createSession(memberId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.$transaction([
    // Expired sessions are never read again; drop them whenever someone logs in.
    db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    db.session.create({ data: { tokenHash: hashToken(token), memberId, expiresAt } }),
  ]);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  store.delete(SESSION_COOKIE);
}

/** Ends every session of a member, e.g. after a password change or account deletion. */
export async function revokeSessions(memberId: string, exceptSessionId?: string): Promise<void> {
  await db.session.deleteMany({
    where: { memberId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
  });
}

/**
 * The current request's identity, or null. Memoised per request, so layouts,
 * pages and services can all call it freely.
 */
export const getAuth = cache(async (): Promise<AuthContext | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      member: {
        select: {
          id: true,
          role: true,
          name: true,
          nameNormalized: true,
          permissions: { select: { permission: true, allowed: true } },
          studentProfile: { select: { status: true } },
          teacherProfile: { select: { status: true } },
        },
      },
    },
  });
  if (!session || session.expiresAt < new Date()) return null;

  const { member } = session;
  const roleSettings =
    member.role === "ADMIN"
      ? []
      : await db.rolePermission.findMany({
          where: { role: member.role },
          select: { permission: true, allowed: true },
        });

  return {
    sessionId: session.id,
    memberId: member.id,
    role: member.role,
    name: member.name,
    nameNormalized: member.nameNormalized,
    permissions: resolvePermissions(member.role, roleSettings, member.permissions),
    blocked:
      (member.role === "STUDENT" && member.studentProfile?.status === "DROPPED") ||
      (member.role === "TEACHER" && member.teacherProfile?.status === "SUSPENDED"),
  };
});
