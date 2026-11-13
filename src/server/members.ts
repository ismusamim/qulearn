import "server-only";

import { fixName, normalizeArabic, normalizePhone } from "@/lib/arabic";
import type { Role } from "@/lib/constants";
import { generatePassword, hashPassword } from "@/server/auth/password";
import { db, type Tx } from "@/server/db";
import { ConflictError } from "@/server/errors";

/**
 * Low-level account creation shared by the features that add people
 * (members, students, teachers, import). It performs NO authorisation — the
 * calling service must have checked that already.
 */

export interface NewMemberInput {
  role: Role;
  name: string;
  phone?: string;
  /** Omit to generate a 6-digit password; pass null to create an account that cannot log in yet. */
  password?: string | null;
  photo?: string | null;
  extra?: Record<string, string>;
}

export interface NewMemberResult {
  id: string;
  name: string;
  /** The plain password — the only moment it is available. Null when the account has none. */
  password: string | null;
}

/** True when another member of the same role already has this (normalised) name. */
export async function memberNameTaken(role: Role, name: string, exceptId?: string, client: Tx | typeof db = db): Promise<boolean> {
  const clash = await client.member.findFirst({
    where: { role, nameNormalized: normalizeArabic(name), ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  return !!clash;
}

/**
 * Creates the Member row and the profile its role requires (StudentProfile /
 * TeacherProfile, with defaults — callers update the profile afterwards in the
 * same transaction). Rejects a duplicate name within the same role.
 */
export async function createMemberRecord(client: Tx | typeof db, input: NewMemberInput): Promise<NewMemberResult> {
  const name = fixName(input.name);
  if (await memberNameTaken(input.role, name, undefined, client)) {
    throw new ConflictError(`يوجد حساب بالاسم نفسه: ${name}`);
  }
  const password = input.password === undefined ? generatePassword() : input.password;
  const member = await client.member.create({
    data: {
      role: input.role,
      name,
      nameNormalized: normalizeArabic(name),
      phone: normalizePhone(input.phone),
      passwordHash: password ? await hashPassword(password) : null,
      photo: input.photo ?? null,
      extra: input.extra ?? {},
      ...(input.role === "STUDENT" ? { studentProfile: { create: {} } } : {}),
      ...(input.role === "TEACHER" ? { teacherProfile: { create: {} } } : {}),
    },
    select: { id: true, name: true },
  });
  return { ...member, password };
}

/** Sets a new password (generated when omitted) and returns it in plain text, once. */
export async function resetMemberPassword(memberId: string, password: string = generatePassword()): Promise<string> {
  await db.$transaction([
    db.member.update({ where: { id: memberId }, data: { passwordHash: await hashPassword(password) } }),
    db.session.deleteMany({ where: { memberId } }),
  ]);
  return password;
}
