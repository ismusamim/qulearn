import "server-only";

import type { z } from "zod";

import { fixName, normalizeArabic, normalizePhone } from "@/lib/arabic";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/constants";
import { type AuthContext, assertRole } from "@/server/auth";
import { generatePassword, hashPassword, verifyPassword } from "@/server/auth/password";
import { revokeSessions } from "@/server/auth/session";
import { db } from "@/server/db";
import { halaqaLabelMap } from "@/server/directory";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";
import { createMemberRecord, memberNameTaken, resetMemberPassword } from "@/server/members";

import { whatsappNumber } from "./domain";
import type {
  bulkResetSchema,
  createMemberSchema,
  deleteMembersSchema,
  setPasswordSchema,
  updateMemberSchema,
} from "./schemas";

/** One row of the members table. Never carries the password or its hash. */
export interface MemberRowDTO {
  id: string;
  role: Role;
  name: string;
  phone: string;
  /** False when the account has no password yet. */
  canLogin: boolean;
  /** International number for wa.me, or "" when the member has no usable number. */
  whatsapp: string;
  /** Other roles held under the same name (the person can switch between them). */
  otherRoles: Role[];
  /** Students: label of their halaqa, null when unassigned. */
  halaqaLabel: string | null;
  /** Students only. */
  dropped: boolean;
  /** Teachers and supervisors: labels of the halaqat they run. */
  halaqat: string[];
  /** The signed-in administrator's own account (cannot be deleted or locked out). */
  isSelf: boolean;
}

export interface MembersListDTO {
  role: Role;
  members: MemberRowDTO[];
  counts: Record<Role, number>;
}

/** A freshly generated password — the only moment it exists in plain text. */
export interface CredentialDTO {
  id: string;
  name: string;
  password: string;
  whatsapp: string;
}

/** What is needed to work out where a member's login message should be sent. */
const contactSelect = {
  id: true,
  name: true,
  phone: true,
  studentProfile: {
    select: { category: true, phone: true, whatsapp: true, guardianPhone: true, guardianWhatsapp: true },
  },
} as const;

interface Contact {
  phone: string;
  studentProfile: {
    category: "CHILD" | "ADULT";
    phone: string;
    whatsapp: string;
    guardianPhone: string;
    guardianWhatsapp: string;
  } | null;
}

/** A child's message goes to the guardian; everyone else receives their own. */
function whatsappOf(member: Contact): string {
  const p = member.studentProfile;
  if (!p) return whatsappNumber(member.phone);
  const guardian = p.category === "CHILD" ? [p.guardianWhatsapp, p.guardianPhone] : [];
  return whatsappNumber(...guardian, p.whatsapp, p.phone, member.phone);
}

export async function listMembers(auth: AuthContext, role: Role): Promise<MembersListDTO> {
  assertRole(auth, "ADMIN");
  const [rows, grouped, halaqat] = await Promise.all([
    db.member.findMany({
      where: { role },
      orderBy: { name: "asc" },
      select: {
        ...contactSelect,
        nameNormalized: true,
        passwordHash: true,
        studentProfile: {
          select: { ...contactSelect.studentProfile.select, halaqaId: true, status: true },
        },
        taughtHalaqat: { select: { id: true } },
        supervisedHalaqat: { select: { id: true } },
      },
    }),
    db.member.groupBy({ by: ["role"], _count: { _all: true } }),
    halaqaLabelMap(),
  ]);

  const twins = await db.member.findMany({
    where: { role: { not: role }, nameNormalized: { in: rows.map((m) => m.nameNormalized) } },
    select: { nameNormalized: true, role: true },
  });
  const rolesByName = new Map<string, Role[]>();
  for (const t of twins) rolesByName.set(t.nameNormalized, [...(rolesByName.get(t.nameNormalized) ?? []), t.role]);

  const counts = Object.fromEntries(ROLES.map((r) => [r, 0])) as Record<Role, number>;
  for (const g of grouped) counts[g.role] = g._count._all;

  const labels = (ids: Array<{ id: string }>) =>
    ids.map((h) => halaqat.get(h.id)?.label).filter((l): l is string => !!l);

  return {
    role,
    counts,
    members: rows.map((m) => ({
      id: m.id,
      role,
      name: m.name,
      phone: m.phone,
      canLogin: m.passwordHash !== null,
      whatsapp: whatsappOf(m),
      otherRoles: ROLES.filter((r) => rolesByName.get(m.nameNormalized)?.includes(r)),
      halaqaLabel: (m.studentProfile?.halaqaId && halaqat.get(m.studentProfile.halaqaId)?.label) || null,
      dropped: m.studentProfile?.status === "DROPPED",
      halaqat: labels(role === "SUPERVISOR" ? m.supervisedHalaqat : m.taughtHalaqat),
      isSelf: m.id === auth.memberId,
    })),
  };
}

/**
 * Creates the basic account (plus the empty profile a student or teacher
 * needs); the full form is filled in from the students / teachers sections.
 */
export async function createMember(auth: AuthContext, input: z.output<typeof createMemberSchema>): Promise<CredentialDTO> {
  assertRole(auth, "ADMIN");
  const created = await createMemberRecord(db, { role: input.role, name: input.name, phone: input.phone });
  // createMemberRecord always generates a password when none is passed.
  return { id: created.id, name: created.name, password: created.password ?? "", whatsapp: whatsappNumber(input.phone) };
}

export async function updateMember(auth: AuthContext, input: z.output<typeof updateMemberSchema>): Promise<void> {
  assertRole(auth, "ADMIN");
  const existing = await db.member.findUnique({ where: { id: input.id }, select: { role: true } });
  if (!existing) throw new NotFoundError("العضو غير موجود");
  const name = fixName(input.name);
  if (await memberNameTaken(existing.role, name, input.id)) {
    throw new ConflictError(`يوجد ${ROLE_LABELS[existing.role]} بالاسم نفسه`);
  }
  await db.member.update({
    where: { id: input.id },
    data: { name, nameNormalized: normalizeArabic(name), phone: normalizePhone(input.phone) },
  });
}

async function findContact(id: string) {
  const member = await db.member.findUnique({ where: { id }, select: contactSelect });
  if (!member) throw new NotFoundError("العضو غير موجود");
  return member;
}

/**
 * Changing someone's password signs them out everywhere. When the
 * administrator changes their own, the session they are working in survives.
 */
async function applyPassword(auth: AuthContext, memberId: string, password: string): Promise<void> {
  if (memberId !== auth.memberId) {
    await resetMemberPassword(memberId, password);
    return;
  }
  await db.member.update({ where: { id: memberId }, data: { passwordHash: await hashPassword(password) } });
  await revokeSessions(memberId, auth.sessionId);
}

/** Generates a new password (also how an account without one gets its login) and returns it once. */
export async function resetPassword(auth: AuthContext, id: string): Promise<CredentialDTO> {
  assertRole(auth, "ADMIN");
  const member = await findContact(id);
  const password = generatePassword();
  await applyPassword(auth, id, password);
  return { id, name: member.name, password, whatsapp: whatsappOf(member) };
}

export async function setPassword(auth: AuthContext, input: z.output<typeof setPasswordSchema>): Promise<void> {
  assertRole(auth, "ADMIN");
  await findContact(input.id);
  await applyPassword(auth, input.id, input.password);
}

/** Removes the password: the account stays, with all its records, but cannot sign in. */
export async function disableLogin(auth: AuthContext, id: string): Promise<void> {
  assertRole(auth, "ADMIN");
  // Locking yourself out could leave nobody able to manage accounts.
  if (id === auth.memberId) throw new ConflictError("لا يمكنك إيقاف دخول حسابك الحالي");
  await findContact(id);
  await db.$transaction([
    db.member.update({ where: { id }, data: { passwordHash: null } }),
    db.session.deleteMany({ where: { memberId: id } }),
  ]);
}

/** Bulk steps cannot be undone, so the administrator re-enters their own password first. */
async function assertOwnPassword(auth: AuthContext, password: string): Promise<void> {
  const me = await db.member.findUnique({ where: { id: auth.memberId }, select: { passwordHash: true } });
  if (!(await verifyPassword(password, me?.passwordHash))) {
    throw new ValidationError("كلمة المرور غير صحيحة", { confirmPassword: ["كلمة المرور غير صحيحة"] });
  }
}

export interface BulkResetResult {
  credentials: CredentialDTO[];
  /** The administrator's own account was among the ids and was left untouched. */
  skippedSelf: boolean;
}

/** New passwords for several members at once; the old ones stop working immediately. */
export async function bulkResetPasswords(auth: AuthContext, input: z.output<typeof bulkResetSchema>): Promise<BulkResetResult> {
  assertRole(auth, "ADMIN");
  await assertOwnPassword(auth, input.confirmPassword);
  const ids = [...new Set(input.ids)];
  const members = await db.member.findMany({
    where: { id: { in: ids.filter((id) => id !== auth.memberId) } },
    orderBy: { name: "asc" },
    select: contactSelect,
  });
  const credentials: CredentialDTO[] = [];
  // One at a time: hashing is CPU-bound, running them together gains nothing.
  for (const member of members) {
    const password = await resetMemberPassword(member.id);
    credentials.push({ id: member.id, name: member.name, password, whatsapp: whatsappOf(member) });
  }
  return { credentials, skippedSelf: ids.includes(auth.memberId) };
}

export interface DeleteMembersResult {
  deleted: number;
  skippedSelf: boolean;
}

/**
 * Deletes accounts with everything that hangs off them: a student's
 * attendance, recitation, exams and payments go too; a teacher's or
 * supervisor's halaqat stay without one. Sessions are removed with the
 * account, so a deleted member is signed out at once.
 */
export async function deleteMembers(auth: AuthContext, input: z.output<typeof deleteMembersSchema>): Promise<DeleteMembersResult> {
  assertRole(auth, "ADMIN");
  await assertOwnPassword(auth, input.confirmPassword);
  const ids = [...new Set(input.ids)];
  const skippedSelf = ids.includes(auth.memberId);
  const targetIds = ids.filter((id) => id !== auth.memberId);
  if (targetIds.length === 0) throw new ConflictError("لا يمكنك حذف حسابك الحالي");

  const deleted = await db.$transaction(async (tx) => {
    const targets = await tx.member.findMany({ where: { id: { in: targetIds } }, select: { id: true, role: true } });
    if (targets.length === 0) throw new NotFoundError("العضو غير موجود");
    if (targets.some((m) => m.role === "ADMIN")) {
      const remaining = await tx.member.count({
        where: { role: "ADMIN", passwordHash: { not: null }, id: { notIn: targets.map((m) => m.id) } },
      });
      if (remaining < 1) throw new ConflictError("لا بد أن يبقى مدير واحد على الأقل");
    }
    const result = await tx.member.deleteMany({ where: { id: { in: targets.map((m) => m.id) } } });
    return result.count;
  });
  return { deleted, skippedSelf };
}
