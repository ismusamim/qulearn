import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { fixName, normalizeArabic } from "@/lib/arabic";
import { fromISODate, todayISO } from "@/lib/dates";
import { parseNationalId } from "@/lib/domain/national-id";
import { type AuthContext, assertCan, assertRole } from "@/server/auth";
import { verifyPassword } from "@/server/auth/password";
import { db, type Tx } from "@/server/db";
import { listCustomFields } from "@/server/directory";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";
import { createMemberRecord, memberNameTaken } from "@/server/members";

import type { StudentFeeData, StudentFormData } from "./schemas";
import { birthYearFromAge, primaryPhone } from "./student-rules";

/**
 * Who may change what on a student (the old `members_guard` database trigger):
 *   ADMIN            everything, including delete
 *   students.add     create a student with the full form — but not edit existing ones
 *   students.status  منقطع / منتظم (and its date)
 *   students.move    the halaqa
 *   fees.amount      own amount, fee category, discount (+ per-student value and type)
 * Name, phone, photo, category and the rest of the form are admin-only once saved.
 */

export interface CreatedStudent {
  id: string;
  name: string;
  /** Shown once to whoever filled the form; null never happens for students but mirrors NewMemberResult. */
  password: string | null;
}

async function assertStudentExists(client: Tx | typeof db, id: string) {
  const student = await client.member.findFirst({
    where: { id, role: "STUDENT" },
    select: { id: true, name: true, phone: true, extra: true, studentProfile: { select: { halaqaId: true, status: true } } },
  });
  if (!student) throw new NotFoundError("الطالب غير موجود");
  return student;
}

async function assertUnique(client: Tx | typeof db, name: string, nationalId: string, exceptId?: string): Promise<void> {
  if (await memberNameTaken("STUDENT", name, exceptId, client)) throw new ConflictError("يوجد طالب بالاسم نفسه");
  if (nationalId) {
    const clash = await client.studentProfile.findFirst({
      where: { nationalId, ...(exceptId ? { memberId: { not: exceptId } } : {}) },
      select: { memberId: true },
    });
    if (clash) throw new ConflictError("الرقم القومي مسجّل لطالب آخر");
  }
}

async function assertHalaqaExists(client: Tx | typeof db, halaqaId: string | null): Promise<void> {
  if (!halaqaId) return;
  const halaqa = await client.halaqa.findUnique({ where: { id: halaqaId }, select: { id: true } });
  if (!halaqa) throw new ValidationError("الحلقة غير موجودة");
}

/** Only keys the admin has defined as custom fields are stored. */
async function cleanExtra(extra: Record<string, string>): Promise<Record<string, string>> {
  const defs = await listCustomFields("STUDENTS");
  return Object.fromEntries(defs.map((f) => [f.key, extra[f.key] ?? ""]));
}

/**
 * Form → profile columns. Only the section of the chosen category is written,
 * so switching صغير/كبير by mistake does not wipe the other section.
 */
function profileData(input: StudentFormData): Prisma.StudentProfileUncheckedUpdateInput {
  const nid = parseNationalId(input.nationalId);
  const nidBirth = nid.status === "valid" ? nid.birthDate : null;
  const common: Prisma.StudentProfileUncheckedUpdateInput = {
    category: input.category,
    halaqaId: input.halaqaId,
    nationalId: input.nationalId || null,
    address: input.address,
    phone: input.phone,
    whatsapp: input.whatsapp,
    testReading: input.testReading,
    testTajweed: input.testTajweed,
    testHifz: input.testHifz,
    joinDate: input.joinDate ? fromISODate(input.joinDate) : null,
    pledgeSigned: input.pledgeSigned,
    monthlyFee: input.monthlyFee,
  };
  if (input.category === "CHILD") {
    const birth = input.birthDate ?? nidBirth;
    return {
      ...common,
      birthDate: birth ? fromISODate(birth) : null,
      birthYear: null,
      study: input.study,
      grade: input.grade,
      guardianName: input.guardianName,
      guardianJob: input.guardianJob,
      guardianPhone: input.guardianPhone,
      guardianWhatsapp: input.guardianWhatsapp,
      guardianRelation: input.guardianRelation,
      guardianRelationOther: input.guardianRelation === "شخص آخر" ? input.guardianRelationOther : "",
    };
  }
  return {
    ...common,
    // Adults give an age; the exact date is known only when the national ID carries it.
    birthDate: nidBirth ? fromISODate(nidBirth) : null,
    birthYear: nidBirth ? Number(nidBirth.slice(0, 4)) : birthYearFromAge(input.age),
    maritalStatus: input.maritalStatus,
    qualification: input.qualification,
    qualificationStatus: input.qualificationStatus,
    job: input.job,
    availability: input.availability,
  };
}

/** New application form. Returns the generated password — the only time it is available. */
export async function createStudent(auth: AuthContext, input: StudentFormData): Promise<CreatedStudent> {
  assertCan(auth, "students.add");
  const name = fixName(input.name);
  const extra = await cleanExtra(input.extra);
  return db.$transaction(async (tx) => {
    await assertUnique(tx, name, input.nationalId);
    await assertHalaqaExists(tx, input.halaqaId);
    const member = await createMemberRecord(tx, {
      role: "STUDENT",
      name,
      phone: primaryPhone(input.category, input),
      photo: input.photo,
      extra,
    });
    await tx.studentProfile.update({ where: { memberId: member.id }, data: profileData(input) });
    return member;
  });
}

/** Editing a saved form is the admin's alone (see the table at the top). */
export async function updateStudent(auth: AuthContext, id: string, input: StudentFormData): Promise<void> {
  assertRole(auth, "ADMIN");
  const name = fixName(input.name);
  const extra = await cleanExtra(input.extra);
  await db.$transaction(async (tx) => {
    const existing = await assertStudentExists(tx, id);
    await assertUnique(tx, name, input.nationalId, id);
    await assertHalaqaExists(tx, input.halaqaId);
    const previousExtra =
      existing.extra && typeof existing.extra === "object" && !Array.isArray(existing.extra) ? existing.extra : {};
    await tx.member.update({
      where: { id },
      data: {
        name,
        nameNormalized: normalizeArabic(name),
        phone: primaryPhone(input.category, input, existing.phone),
        photo: input.photo,
        // Values of fields the admin has since removed are left as they are.
        extra: { ...previousExtra, ...extra },
        studentProfile: { update: profileData(input) },
      },
    });
  });
}

/** منقطع / منتظم. A dropped student can still sign in but only sees a notice and cannot write. */
export async function setStudentStatus(auth: AuthContext, id: string, status: "ACTIVE" | "DROPPED"): Promise<void> {
  assertCan(auth, "students.status");
  const student = await assertStudentExists(db, id);
  // Repeating the same status must not move its date.
  if (student.studentProfile?.status === status) return;
  await db.studentProfile.update({
    where: { memberId: id },
    data: { status, statusDate: fromISODate(todayISO()) },
  });
}

/** Moves a student to another halaqa (and so, possibly, another place). */
export async function moveStudent(auth: AuthContext, id: string, halaqaId: string): Promise<void> {
  assertCan(auth, "students.move");
  const student = await assertStudentExists(db, id);
  if (student.studentProfile?.halaqaId === halaqaId) throw new ConflictError("اختر حلقة مختلفة");
  await assertHalaqaExists(db, halaqaId);
  await db.studentProfile.update({ where: { memberId: id }, data: { halaqaId } });
}

/** Fee category, discount and own amount of one student. */
export async function setStudentFee(auth: AuthContext, input: StudentFeeData): Promise<void> {
  assertCan(auth, "fees.amount");
  await assertStudentExists(db, input.id);
  const [category, discount] = await Promise.all([
    input.feeCategoryId ? db.feeCategory.findUnique({ where: { id: input.feeCategoryId }, select: { id: true } }) : null,
    input.feeDiscountId
      ? db.feeDiscount.findUnique({ where: { id: input.feeDiscountId }, select: { id: true, name: true, perStudent: true } })
      : null,
  ]);
  if (input.feeCategoryId && !category) throw new ValidationError("الفئة غير موجودة");
  if (input.feeDiscountId && !discount) throw new ValidationError("الخصم غير موجود");
  if (discount?.perStudent && input.feeDiscountValue == null) {
    throw new ValidationError(`حدّد قيمة خصم «${discount.name}» ونوعه لهذا الطالب`);
  }
  // A value of its own only makes sense together with a discount.
  const value = discount ? input.feeDiscountValue : null;
  await db.studentProfile.update({
    where: { memberId: input.id },
    data: {
      feeCategoryId: input.feeCategoryId,
      feeDiscountId: input.feeDiscountId,
      feeDiscountValue: value,
      feeDiscountType: value == null ? null : input.feeDiscountType,
      // Zero is not an amount of its own: the category applies (see computeFeeDue).
      monthlyFee: input.monthlyFee || null,
    },
  });
}

/**
 * Deletes the account with its attendance, recitation and payment records.
 * Admin only, confirmed by re-entering the admin's own password.
 */
export async function deleteStudent(auth: AuthContext, id: string, password: string): Promise<void> {
  assertRole(auth, "ADMIN");
  const me = await db.member.findUnique({ where: { id: auth.memberId }, select: { passwordHash: true } });
  if (!(await verifyPassword(password, me?.passwordHash))) throw new ValidationError("كلمة المرور غير صحيحة");
  await assertStudentExists(db, id);
  await db.member.delete({ where: { id } });
}
