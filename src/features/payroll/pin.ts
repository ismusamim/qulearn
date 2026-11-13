import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

import type { AuthContext } from "@/server/auth";

/**
 * The optional payroll PIN is a second lock on top of the ADMIN role. After a
 * correct PIN the browser gets a short-lived httpOnly cookie. The cookie is a
 * signature over (login session, expiry) keyed with the stored PIN hash, so it
 * cannot be forged without the hash, does not work for another login session,
 * and stops working as soon as the PIN changes.
 */
const COOKIE = "qulearn_payroll";
const HOURS = 8;
/** Server actions post to the page they were called from, so the cookie never leaves the payroll section. */
const PATH = "/payroll";

function sign(auth: AuthContext, pinHash: string, expires: number): string {
  return createHmac("sha256", pinHash).update(`${auth.sessionId}.${expires}`).digest("base64url");
}

export async function isPayrollUnlocked(auth: AuthContext, pinHash: string): Promise<boolean> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return false;
  const [exp, mac] = value.split(".");
  const expires = Number(exp);
  if (!mac || !Number.isFinite(expires) || expires < Date.now()) return false;
  const expected = Buffer.from(sign(auth, pinHash, expires));
  const given = Buffer.from(mac);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Only callable from a server action (cookies are read-only while rendering). */
export async function grantPayrollUnlock(auth: AuthContext, pinHash: string): Promise<void> {
  const expires = Date.now() + HOURS * 60 * 60 * 1000;
  (await cookies()).set(COOKIE, `${expires}.${sign(auth, pinHash, expires)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: PATH,
    // No maxAge: the cookie also ends with the browser session.
  });
}

export async function clearPayrollUnlock(): Promise<void> {
  (await cookies()).delete({ name: COOKIE, path: PATH });
}
