import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { ForbiddenError, NotFoundError } from "@/server/errors";

import type { AuthContext } from "./session";

/**
 * Row-level scope, replacing the old database RLS rules:
 *  - admin: every halaqa
 *  - teacher: the halaqat they teach
 *  - supervisor: the halaqat assigned to them
 *  - everyone else: none
 */

/** Prisma filter for the halaqat this user runs. */
export function managedHalaqaWhere(auth: AuthContext): Prisma.HalaqaWhereInput {
  switch (auth.role) {
    case "ADMIN":
      return {};
    case "TEACHER":
      return { teacherId: auth.memberId };
    case "SUPERVISOR":
      return { supervisorId: auth.memberId };
    default:
      return { id: { in: [] } };
  }
}

/** Prisma filter (on Member) for the students this user records attendance and recitation for. */
export function teachableStudentWhere(auth: AuthContext): Prisma.MemberWhereInput {
  if (auth.role === "ADMIN") return { role: "STUDENT" };
  return { role: "STUDENT", studentProfile: { halaqa: { is: managedHalaqaWhere(auth) } } };
}

export async function canManageHalaqa(auth: AuthContext, halaqaId: string): Promise<boolean> {
  if (auth.role === "ADMIN") return true;
  const found = await db.halaqa.findFirst({
    where: { id: halaqaId, ...managedHalaqaWhere(auth) },
    select: { id: true },
  });
  return !!found;
}

export async function assertCanManageHalaqa(auth: AuthContext, halaqaId: string): Promise<void> {
  if (!(await canManageHalaqa(auth, halaqaId))) throw new ForbiddenError("هذه ليست حلقتك");
}

/** May this user record attendance / recitation for the student? */
export async function canTeachStudent(auth: AuthContext, studentId: string): Promise<boolean> {
  const found = await db.member.findFirst({
    where: { id: studentId, ...teachableStudentWhere(auth) },
    select: { id: true },
  });
  return !!found;
}

export async function assertCanTeachStudent(auth: AuthContext, studentId: string): Promise<void> {
  if (!(await canTeachStudent(auth, studentId))) throw new ForbiddenError("هذا الطالب ليس في حلقاتك");
}

/** May this user read the student's attendance and recitation? (their teachers, or the student) */
export async function assertCanSeeStudent(auth: AuthContext, studentId: string): Promise<void> {
  if (auth.memberId === studentId) return;
  if (await canTeachStudent(auth, studentId)) return;
  const exists = await db.member.findFirst({ where: { id: studentId, role: "STUDENT" }, select: { id: true } });
  if (!exists) throw new NotFoundError("الطالب غير موجود");
  throw new ForbiddenError();
}
