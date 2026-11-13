import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { normalizeArabic } from "@/lib/arabic";
import { toISODate } from "@/lib/dates";
import { computeFeeDue, type FeeCategoryInput, type FeeDiscountInput, type FeeDue } from "@/lib/domain/fees";
import { type AuthContext, assertCan, assertCanAny, can, canAny, hasRole } from "@/server/auth";
import { type CustomFieldDef, halaqaLabelMap, listAllHalaqaOptions, listCustomFields, listPlaceOptions, type PlaceOption } from "@/server/directory";
import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";

import type { StudentFilters } from "./schemas";
import { attendanceRateText, hifzPositionText, studentAge } from "./student-rules";

/** Holding any of these opens the students section (admins hold them all). */
const STUDENT_PERMISSIONS = ["students.add", "students.status", "students.move", "fees.amount"] as const;

export function canOpenStudents(auth: AuthContext): boolean {
  return canAny(auth, ...STUDENT_PERMISSIONS);
}

/** What the signed-in user may do with students; drives which buttons are shown (the service re-checks). */
export interface StudentCaps {
  add: boolean;
  edit: boolean;
  status: boolean;
  move: boolean;
  fee: boolean;
  remove: boolean;
  /** Last memorised position and attendance rate columns. */
  stats: boolean;
}

export function studentCaps(auth: AuthContext): StudentCaps {
  const admin = hasRole(auth, "ADMIN");
  return {
    add: can(auth, "students.add"),
    edit: admin,
    status: can(auth, "students.status"),
    move: can(auth, "students.move"),
    fee: can(auth, "fees.amount"),
    remove: admin,
    stats: admin,
  };
}

export interface StudentFeeSettings {
  monthlyFee: number | null;
  feeCategoryId: string | null;
  feeDiscountId: string | null;
  feeDiscountValue: number | null;
  feeDiscountType: "PERCENT" | "AMOUNT" | null;
}

export interface StudentRowDTO {
  id: string;
  name: string;
  photo: string | null;
  category: "CHILD" | "ADULT";
  age: number | null;
  halaqaId: string | null;
  halaqaLabel: string | null;
  placeName: string | null;
  status: "ACTIVE" | "DROPPED";
  statusDate: string | null;
  /** Admin only. */
  lastHifz: string | null;
  attendance: string | null;
  /** Only for holders of fees.amount. */
  fee: StudentFeeSettings | null;
}

export interface StudentListDTO {
  rows: StudentRowDTO[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
}

export const STUDENTS_PAGE_SIZE = 50;

const num = (value: Prisma.Decimal | null | undefined): number | null => (value == null ? null : Number(value));

const feeSettings = (p: {
  monthlyFee: Prisma.Decimal | null;
  feeCategoryId: string | null;
  feeDiscountId: string | null;
  feeDiscountValue: Prisma.Decimal | null;
  feeDiscountType: "PERCENT" | "AMOUNT" | null;
}): StudentFeeSettings => ({
  monthlyFee: num(p.monthlyFee),
  feeCategoryId: p.feeCategoryId,
  feeDiscountId: p.feeDiscountId,
  feeDiscountValue: num(p.feeDiscountValue),
  feeDiscountType: p.feeDiscountType,
});

/** Last HIFZ record and attendance rate for a page of students, in two aggregate queries. */
async function loadStats(ids: string[]): Promise<Map<string, { lastHifz: string; attendance: string }>> {
  const [hifz, attendance] = await Promise.all([
    db.recitation.findMany({
      where: { studentId: { in: ids }, type: "HIFZ" },
      orderBy: [{ studentId: "asc" }, { date: "desc" }, { createdAt: "desc" }],
      distinct: ["studentId"],
      select: { studentId: true, surah: true, fromAyah: true, toAyah: true },
    }),
    db.attendance.groupBy({ by: ["studentId", "status"], where: { studentId: { in: ids } }, _count: { _all: true } }),
  ]);
  const lastById = new Map(hifz.map((r) => [r.studentId, r]));
  const counts = new Map<string, { attended: number; total: number }>();
  for (const row of attendance) {
    const c = counts.get(row.studentId) ?? { attended: 0, total: 0 };
    c.total += row._count._all;
    if (row.status === "PRESENT" || row.status === "LATE") c.attended += row._count._all;
    counts.set(row.studentId, c);
  }
  return new Map(
    ids.map((id) => {
      const c = counts.get(id);
      return [id, { lastHifz: hifzPositionText(lastById.get(id)), attendance: attendanceRateText(c?.attended ?? 0, c?.total ?? 0) }];
    }),
  );
}

/**
 * The students list. Category / halaqa / status are filtered in the database;
 * the text search also matches the halaqa's display label and place, which are
 * computed, so it runs in memory on a slim projection. Photos and statistics
 * are loaded for the visible page only.
 */
export async function listStudents(auth: AuthContext, filters: StudentFilters): Promise<StudentListDTO> {
  assertCanAny(auth, ...STUDENT_PERMISSIONS);
  const caps = studentCaps(auth);

  const profileWhere: Prisma.StudentProfileWhereInput = {
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.halaqaId ? { halaqaId: filters.halaqaId === "none" ? null : filters.halaqaId } : {}),
  };
  const [members, halaqat] = await Promise.all([
    db.member.findMany({
      where: { role: "STUDENT", ...(Object.keys(profileWhere).length ? { studentProfile: { is: profileWhere } } : {}) },
      select: {
        id: true,
        name: true,
        nameNormalized: true,
        studentProfile: {
          select: {
            category: true,
            halaqaId: true,
            status: true,
            statusDate: true,
            birthDate: true,
            birthYear: true,
            monthlyFee: true,
            feeCategoryId: true,
            feeDiscountId: true,
            feeDiscountValue: true,
            feeDiscountType: true,
          },
        },
      },
    }),
    halaqaLabelMap(),
  ]);

  const q = normalizeArabic(filters.q);
  const matched = members
    .filter((m) => {
      if (!q) return true;
      const h = m.studentProfile?.halaqaId ? halaqat.get(m.studentProfile.halaqaId) : undefined;
      return (
        m.nameNormalized.includes(q) ||
        (!!h && (normalizeArabic(h.label).includes(q) || normalizeArabic(h.placeName).includes(q)))
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));

  const total = matched.length;
  const pageCount = Math.max(1, Math.ceil(total / STUDENTS_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const visible = matched.slice((page - 1) * STUDENTS_PAGE_SIZE, page * STUDENTS_PAGE_SIZE);
  const ids = visible.map((m) => m.id);

  const [photos, stats] = await Promise.all([
    db.member.findMany({ where: { id: { in: ids }, photo: { not: null } }, select: { id: true, photo: true } }),
    caps.stats && ids.length ? loadStats(ids) : null,
  ]);
  const photoById = new Map(photos.map((p) => [p.id, p.photo]));

  const rows = visible.map((m): StudentRowDTO => {
    const p = m.studentProfile;
    const h = p?.halaqaId ? halaqat.get(p.halaqaId) : undefined;
    return {
      id: m.id,
      name: m.name,
      photo: photoById.get(m.id) ?? null,
      category: p?.category ?? "CHILD",
      age: studentAge({ birthDate: toISODate(p?.birthDate), birthYear: p?.birthYear ?? null }),
      halaqaId: p?.halaqaId ?? null,
      halaqaLabel: h?.label ?? null,
      placeName: h?.placeName ?? null,
      status: p?.status ?? "ACTIVE",
      statusDate: toISODate(p?.statusDate),
      lastHifz: stats?.get(m.id)?.lastHifz ?? null,
      attendance: stats?.get(m.id)?.attendance ?? null,
      fee: caps.fee && p ? feeSettings(p) : null,
    };
  });
  return { rows, total, page, pageCount, pageSize: STUDENTS_PAGE_SIZE };
}

// ───────────── Dropdown data ─────────────

export interface HalaqaChoice {
  id: string;
  label: string;
  placeId: string | null;
  placeName: string | null;
}

/** Halaqat for the list filter, the form and the move dialog (names only). */
export async function listHalaqaChoices(auth: AuthContext): Promise<HalaqaChoice[]> {
  assertCanAny(auth, ...STUDENT_PERMISSIONS);
  return (await listAllHalaqaOptions()).map((h) => ({ id: h.id, label: h.label, placeId: h.placeId, placeName: h.placeName }));
}

export interface StudentFormOptions {
  halaqat: HalaqaChoice[];
  places: PlaceOption[];
  customFields: CustomFieldDef[];
}

export async function getStudentFormOptions(auth: AuthContext): Promise<StudentFormOptions> {
  assertCan(auth, "students.add");
  const [halaqat, places, customFields] = await Promise.all([
    listHalaqaChoices(auth),
    listPlaceOptions(),
    listCustomFields("STUDENTS"),
  ]);
  return { halaqat, places: places.map((p) => ({ id: p.id, name: p.name, type: p.type })), customFields };
}

export interface FeeOptions {
  categories: FeeCategoryInput[];
  discounts: FeeDiscountInput[];
}

async function loadFeeOptions(): Promise<FeeOptions> {
  const [categories, discounts] = await Promise.all([
    db.feeCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.feeDiscount.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  return {
    categories: categories.map((c) => ({ id: c.id, name: c.name, amount: Number(c.amount), defaultFor: c.defaultFor })),
    discounts: discounts.map((d) => ({ id: d.id, name: d.name, type: d.type, value: Number(d.value), perStudent: d.perStudent })),
  };
}

/** Fee categories and discounts for the «فئة واشتراك» picker. */
export async function listFeeOptions(auth: AuthContext): Promise<FeeOptions> {
  assertCan(auth, "fees.amount");
  return loadFeeOptions();
}

// ───────────── One student (file / edit form) ─────────────

export interface StudentDTO extends StudentFeeSettings {
  id: string;
  name: string;
  photo: string | null;
  extra: Record<string, string>;
  category: "CHILD" | "ADULT";
  status: "ACTIVE" | "DROPPED";
  statusDate: string | null;
  nationalId: string;
  birthDate: string | null;
  birthYear: number | null;
  age: number | null;
  address: string;
  phone: string;
  whatsapp: string;
  study: string;
  grade: string;
  guardianName: string;
  guardianJob: string;
  guardianPhone: string;
  guardianWhatsapp: string;
  guardianRelation: string;
  guardianRelationOther: string;
  maritalStatus: string;
  qualification: string;
  qualificationStatus: string;
  job: string;
  availability: string;
  testReading: string;
  testTajweed: string;
  testHifz: string;
  halaqaId: string | null;
  halaqaLabel: string | null;
  placeId: string | null;
  placeName: string | null;
  schedule: string;
  joinDate: string | null;
  pledgeSigned: boolean;
  customFields: CustomFieldDef[];
  /** What the student owes per month after category and discount; only for holders of fees.amount. */
  feeDue: FeeDue | null;
}

const asStringRecord = (value: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value)) if (v != null && typeof v !== "object") out[k] = String(v);
  }
  return out;
};

/** The whole application form of one student, for «ملف الطالب» and the edit form. */
export async function getStudent(auth: AuthContext, id: string): Promise<StudentDTO> {
  assertCanAny(auth, ...STUDENT_PERMISSIONS);
  const [member, halaqat, customFields] = await Promise.all([
    db.member.findFirst({
      where: { id, role: "STUDENT" },
      select: { id: true, name: true, photo: true, extra: true, studentProfile: true },
    }),
    halaqaLabelMap(),
    listCustomFields("STUDENTS"),
  ]);
  const p = member?.studentProfile;
  if (!member || !p) throw new NotFoundError("الطالب غير موجود");

  const h = p.halaqaId ? halaqat.get(p.halaqaId) : undefined;
  const fee = feeSettings(p);
  let feeDue: FeeDue | null = null;
  if (can(auth, "fees.amount")) {
    const options = await loadFeeOptions();
    feeDue = computeFeeDue({ category: p.category, ...fee }, options.categories, options.discounts);
  }
  const birthDate = toISODate(p.birthDate);
  return {
    id: member.id,
    name: member.name,
    photo: member.photo,
    extra: asStringRecord(member.extra),
    category: p.category,
    status: p.status,
    statusDate: toISODate(p.statusDate),
    nationalId: p.nationalId ?? "",
    birthDate,
    birthYear: p.birthYear,
    age: studentAge({ birthDate, birthYear: p.birthYear }),
    address: p.address,
    phone: p.phone,
    whatsapp: p.whatsapp,
    study: p.study,
    grade: p.grade,
    guardianName: p.guardianName,
    guardianJob: p.guardianJob,
    guardianPhone: p.guardianPhone,
    guardianWhatsapp: p.guardianWhatsapp,
    guardianRelation: p.guardianRelation,
    guardianRelationOther: p.guardianRelationOther,
    maritalStatus: p.maritalStatus,
    qualification: p.qualification,
    qualificationStatus: p.qualificationStatus,
    job: p.job,
    availability: p.availability,
    testReading: p.testReading,
    testTajweed: p.testTajweed,
    testHifz: p.testHifz,
    halaqaId: p.halaqaId,
    halaqaLabel: h?.label ?? null,
    placeId: h?.placeId ?? null,
    placeName: h?.placeName ?? null,
    schedule: h?.schedule ?? "",
    joinDate: toISODate(p.joinDate),
    pledgeSigned: p.pledgeSigned,
    customFields,
    feeDue,
    ...fee,
  };
}
