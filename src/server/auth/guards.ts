import "server-only";

import { redirect } from "next/navigation";

import type { Role } from "@/lib/constants";
import { ForbiddenError, UnauthenticatedError } from "@/server/errors";

import type { PermissionKey } from "@/lib/permissions";
import { type AuthContext, getAuth } from "./session";

// ───────────── Checks (pure, on an AuthContext) ─────────────

export function hasRole(auth: AuthContext, ...roles: Role[]): boolean {
  return roles.includes(auth.role);
}

export function can(auth: AuthContext, permission: PermissionKey): boolean {
  return auth.role === "ADMIN" || auth.permissions.has(permission);
}

export function canAny(auth: AuthContext, ...permissions: PermissionKey[]): boolean {
  return permissions.some((p) => can(auth, p));
}

// ───────────── Assertions for services (throw AppError) ─────────────

export function assertRole(auth: AuthContext, ...roles: Role[]): void {
  if (!hasRole(auth, ...roles)) throw new ForbiddenError();
}

export function assertCan(auth: AuthContext, permission: PermissionKey): void {
  if (!can(auth, permission)) throw new ForbiddenError();
}

export function assertCanAny(auth: AuthContext, ...permissions: PermissionKey[]): void {
  if (!canAny(auth, ...permissions)) throw new ForbiddenError();
}

/** Blocked accounts (dropped student, suspended teacher) cannot write anything. */
export function assertNotBlocked(auth: AuthContext): void {
  if (auth.blocked) throw new ForbiddenError("حسابك موقوف");
}

/** For server actions: the caller's identity, or UnauthenticatedError. */
export async function requireAuth(): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) throw new UnauthenticatedError();
  return auth;
}

// ───────────── Guards for pages and layouts (redirect) ─────────────

/** Use at the top of a page: redirects to /login when signed out. */
export async function requirePageAuth(): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  return auth;
}

/**
 * Use at the top of a page that only some users may open. Anyone else is sent
 * to their home page. `allow` receives the AuthContext and returns whether
 * the page is theirs to see, e.g.
 *
 *   const auth = await requirePage((a) => hasRole(a, "ADMIN") || can(a, "fees.collect"));
 */
export async function requirePage(allow: (auth: AuthContext) => boolean): Promise<AuthContext> {
  const auth = await requirePageAuth();
  if (!allow(auth)) redirect("/");
  return auth;
}
