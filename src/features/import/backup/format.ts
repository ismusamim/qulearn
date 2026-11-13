/**
 * The qulearn backup document (version 1).
 *
 *   {
 *     "format": "qulearn-backup",
 *     "version": 1,
 *     "exportedAt": "2026-01-31T10:00:00.000Z",
 *     "data": { <table>: [rows…], … }
 *   }
 *
 * `data` mirrors the database one table per key, rows as flat objects with the
 * Prisma field names. Conventions:
 *   - ids are UUID strings and references use them (`halaqa.teacherId` → `members.id`);
 *   - date-only values are "YYYY-MM-DD", timestamps are ISO 8601;
 *   - money and hours are plain numbers;
 *   - enum values are the Prisma enum names ("PRESENT", "HIFZ", "MOSQUE"…);
 *   - `members.passwordHash` is a bcrypt hash (never a plain password), null = cannot log in;
 *   - `payrollSettings` and `examSettings` are single objects (or null = defaults);
 *   - login sessions are not part of a backup.
 * Every table is optional when reading, so a partial document restores as far as it goes.
 */
import { z } from "zod";

import { isISODate } from "@/lib/dates";

export const BACKUP_FORMAT = "qulearn-backup";
export const BACKUP_VERSION = 1;

const id = z.guid().transform((v) => v.toLowerCase());
const idOrNull = id.nullable().default(null);
const text = z.string().default("");
const textOrNull = z.string().nullable().default(null);
const num = z.number().finite();
const numOrNull = num.nullable().default(null);
const int = z.number().int();
const intOrNull = int.nullable().default(null);
const date = z.string().refine(isISODate, "تاريخ غير صحيح");
const dateOrNull = date.nullable().default(null);
const timestamp = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "وقت غير صحيح");
const timestampOpt = timestamp.optional();
const timestampOrNull = timestamp.nullable().default(null);
const year = int.min(1900).max(2200);
const month = int.min(1).max(12);

export const ROLE_VALUES = ["ADMIN", "SUPERVISOR", "TEACHER", "STUDENT", "ACCOUNTANT"] as const;
const role = z.enum(ROLE_VALUES);
const discountType = z.enum(["PERCENT", "AMOUNT"]);
const fieldKind = z.enum(["STUDENTS", "TEACHERS"]);

const setting = z.object({ key: z.string().min(1), value: z.unknown() });

const member = z.object({
  id,
  role,
  name: z.string().min(1),
  phone: text,
  passwordHash: textOrNull,
  photo: textOrNull,
  extra: z.record(z.string(), z.string()).default({}),
  createdAt: timestampOpt,
});

const rolePermission = z.object({ role, permission: z.string().min(1), allowed: z.boolean() });
const memberPermission = z.object({ memberId: id, permission: z.string().min(1), allowed: z.boolean() });

const studentProfile = z.object({
  memberId: id,
  category: z.enum(["CHILD", "ADULT"]).default("CHILD"),
  halaqaId: idOrNull,
  status: z.enum(["ACTIVE", "DROPPED"]).default("ACTIVE"),
  statusDate: dateOrNull,
  nationalId: textOrNull,
  birthDate: dateOrNull,
  birthYear: intOrNull,
  address: text,
  phone: text,
  whatsapp: text,
  study: text,
  grade: text,
  guardianName: text,
  guardianJob: text,
  guardianPhone: text,
  guardianWhatsapp: text,
  guardianRelation: text,
  guardianRelationOther: text,
  maritalStatus: text,
  qualification: text,
  qualificationStatus: text,
  job: text,
  availability: text,
  testReading: text,
  testTajweed: text,
  testHifz: text,
  joinDate: dateOrNull,
  pledgeSigned: z.boolean().default(false),
  monthlyFee: numOrNull,
  feeCategoryId: idOrNull,
  feeDiscountId: idOrNull,
  feeDiscountValue: numOrNull,
  feeDiscountType: discountType.nullable().default(null),
});

const teacherProfile = z.object({
  memberId: id,
  fullName: text,
  birthDate: dateOrNull,
  email: text,
  address: text,
  emergencyContact: text,
  employeeNo: text,
  joinDate: dateOrNull,
  contractType: text,
  status: z.enum(["ACTIVE", "ON_LEAVE", "SUSPENDED"]).default("ACTIVE"),
  monthlyPay: numOrNull,
  adminNote: text,
  qualification: text,
  riwaya: text,
  ijaza: text,
  sanad: text,
  memorizedParts: intOrNull,
  experienceYears: intOrNull,
  specialty: text,
  courses: text,
});

const place = z.object({ id, name: z.string().min(1), type: z.enum(["MOSQUE", "DAR"]).default("MOSQUE"), address: text });

const halaqa = z.object({
  id,
  name: text,
  teacherId: idOrNull,
  supervisorId: idOrNull,
  placeId: idOrNull,
  scheduleMode: z.enum(["CLOCK", "PRAYER"]).nullable().default(null),
  startTime: textOrNull,
  endTime: textOrNull,
  startPrayer: textOrNull,
  endPrayer: textOrNull,
});

const attendance = z.object({
  id,
  studentId: id,
  date,
  status: z.enum(["PRESENT", "LATE", "EXCUSED", "ABSENT"]),
  recordedById: idOrNull,
  createdAt: timestampOpt,
});

const recitation = z.object({
  id,
  studentId: id,
  date,
  type: z.enum(["HIFZ", "REVIEW", "CONSOLIDATION"]),
  surah: int.min(1).max(114),
  fromAyah: int.min(1).max(300),
  toAyah: int.min(1).max(300),
  grade: textOrNull,
  note: text,
  recordedById: idOrNull,
  createdAt: timestampOpt,
});

const news = z.object({
  id,
  text: z.string(),
  audience: z.enum(["ALL", ...ROLE_VALUES]).default("ALL"),
  date,
  authorId: idOrNull,
  authorLabel: textOrNull,
  createdAt: timestampOpt,
});

const customField = z.object({
  kind: fieldKind,
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["TEXT", "NUMBER", "DATE", "TEXTAREA"]).default("TEXT"),
});

const pendingColumn = z.object({
  id,
  kind: fieldKind,
  header: z.string(),
  /** Added in schema migration db_optimizations; older backups default to TEXT. */
  type: z.enum(["TEXT", "NUMBER", "DATE", "TEXTAREA"]).default("TEXT"),
  values: z.array(z.object({ memberId: id, name: text, value: z.string() })).default([]),
  date,
});

const payrollSettings = z.object({
  absenceWithPermission: num.default(20),
  absenceNoPermission: num.default(30),
  meetingWithPermission: num.default(50),
  meetingNoPermission: num.default(70),
  roundTo: int.default(5),
  leaveDays3: int.default(10),
  leaveDays6: int.default(21),
  defaultHours: num.default(26),
  pinHash: textOrNull,
});

const employee = z.object({
  id,
  code: textOrNull,
  name: z.string().min(1),
  jobTitle: textOrNull,
  workSystem: textOrNull,
  status: z.enum(["ACTIVE", "STOPPED"]).default("ACTIVE"),
  basic: numOrNull,
  rate: numOrNull,
  incentive: numOrNull,
  transport: numOrNull,
  hours: numOrNull,
  place: textOrNull,
  note: textOrNull,
  memberId: idOrNull,
});

const payrollRow = z.object({
  id,
  year,
  month,
  employeeId: id,
  name: textOrNull,
  jobTitle: textOrNull,
  baseHours: numOrNull,
  extraHours: numOrNull,
  exceptionalHours: numOrNull,
  absentWithPermission: numOrNull,
  absentNoPermission: numOrNull,
  meetingsWithPermission: numOrNull,
  meetingsNoPermission: numOrNull,
  deductionTest: numOrNull,
  deductionRecitation: numOrNull,
  deductionBooks: numOrNull,
  basic: numOrNull,
  rate: numOrNull,
  incentive: numOrNull,
  transport: numOrNull,
  note: text,
});

const closedMonth = z.object({ year, month });

const teacherAbsence = z.object({
  id,
  year,
  month,
  date,
  employeeId: id,
  name: textOrNull,
  place: textOrNull,
  permission: z.enum(["WITH_PERMISSION", "WITHOUT_PERMISSION"]).nullable().default(null),
  reason: textOrNull,
  proof: z.enum(["BALANCE", "PROVEN"]).nullable().default(null),
  note: textOrNull,
  recordedById: idOrNull,
  recordedByName: textOrNull,
  createdAt: timestampOpt,
});

const feeCategory = z.object({
  id,
  name: z.string(),
  amount: num,
  defaultFor: z.enum(["CHILD", "ADULT"]).nullable().default(null),
  sortOrder: int.default(0),
});

const feeDiscount = z.object({
  id,
  name: z.string(),
  type: discountType.default("PERCENT"),
  value: num.default(0),
  perStudent: z.boolean().default(false),
  sortOrder: int.default(0),
});

const feePayment = z.object({
  id,
  studentId: id,
  year,
  month,
  amount: num,
  date: dateOrNull,
  collectedById: idOrNull,
  collectedByName: textOrNull,
  note: text,
  createdAt: timestampOpt,
});

const collection = z.object({
  id,
  teacherId: id,
  teacherName: textOrNull,
  halaqaId: idOrNull,
  year,
  month,
  status: z.enum(["DRAFT", "SENT", "RETURNED", "DONE"]).default("DRAFT"),
  accountantNote: text,
  sentAt: timestampOrNull,
  reviewedAt: timestampOrNull,
  reviewedByName: textOrNull,
  createdAt: timestampOpt,
});

const collectionLine = z.object({
  id,
  collectionId: id,
  studentId: id,
  amount: num.default(0),
  note: text,
  state: z.enum(["PENDING", "OK", "ISSUE"]).default("PENDING"),
  accountantNote: text,
});

const examSettings = z.object({
  questionScore: num.default(10),
  mistakePenalty: num.default(1),
  promptPenalty: num.default(0.5),
  tajweedPenalty: num.default(0.25),
  excellentFrom: int.default(90),
  veryGoodFrom: int.default(80),
  goodFrom: int.default(65),
  passFrom: int.default(50),
});

const competition = z.object({ id, name: z.string(), createdAt: timestampOpt });

const competitionLevel = z.object({
  id,
  competitionId: id,
  name: z.string(),
  fromJuz: int,
  toJuz: int,
  questionCount: int,
});

const exam = z.object({
  id,
  studentId: id,
  halaqaId: idOrNull,
  type: z.enum(["FOLLOW_UP", "PERIODIC", "MASTERY", "COMPETITION"]),
  date,
  examinerId: idOrNull,
  examinerName: textOrNull,
  juz: intOrNull,
  competitionId: idOrNull,
  competitionName: textOrNull,
  levelId: idOrNull,
  levelName: textOrNull,
  maxScore: numOrNull,
  total: numOrNull,
  grade: textOrNull,
  note: text,
  createdAt: timestampOpt,
});

const examQuestion = z.object({
  id,
  examId: id,
  position: int,
  label: text,
  surah: int.min(1).max(114),
  fromAyah: int.min(1).max(300),
  toAyah: int.min(1).max(300),
  mistakes: int.default(0),
  prompts: int.default(0),
  tajweedMistakes: int.default(0),
  score: num,
});

const list = <T extends z.ZodType>(row: T) => z.array(row).default([]);

export const backupDataSchema = z.object({
  settings: list(setting),
  members: list(member),
  rolePermissions: list(rolePermission),
  memberPermissions: list(memberPermission),
  studentProfiles: list(studentProfile),
  teacherProfiles: list(teacherProfile),
  places: list(place),
  halaqat: list(halaqa),
  attendance: list(attendance),
  recitations: list(recitation),
  news: list(news),
  customFields: list(customField),
  pendingColumns: list(pendingColumn),
  payrollSettings: payrollSettings.nullable().default(null),
  employees: list(employee),
  payrollRows: list(payrollRow),
  payrollClosedMonths: list(closedMonth),
  teacherAbsences: list(teacherAbsence),
  feeCategories: list(feeCategory),
  feeDiscounts: list(feeDiscount),
  feePayments: list(feePayment),
  collections: list(collection),
  collectionLines: list(collectionLine),
  examSettings: examSettings.nullable().default(null),
  competitions: list(competition),
  competitionLevels: list(competitionLevel),
  exams: list(exam),
  examQuestions: list(examQuestion),
});

export const backupDocumentSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: timestamp,
  data: backupDataSchema,
});

export type BackupData = z.output<typeof backupDataSchema>;
export type BackupDocument = z.output<typeof backupDocumentSchema>;

/** Keys of `data` that hold row arrays (everything but the two singletons). */
export type BackupTable = { [K in keyof BackupData]: BackupData[K] extends unknown[] ? K : never }[keyof BackupData];

/** An empty data set with every table present. */
export function emptyBackupData(): BackupData {
  return backupDataSchema.parse({});
}

/** Arabic names of the tables, in the order they are reported. */
export const TABLE_LABELS: Record<keyof BackupData, string> = {
  settings: "الإعدادات",
  members: "الحسابات",
  rolePermissions: "صلاحيات الفئات",
  memberPermissions: "صلاحيات الأفراد",
  studentProfiles: "استمارات الطلاب",
  teacherProfiles: "ملفات المعلمين",
  places: "الأماكن",
  halaqat: "الحلقات",
  attendance: "الحضور",
  recitations: "التسميع",
  news: "الإعلانات",
  customFields: "الحقول الإضافية",
  pendingColumns: "البيانات المعلّقة",
  payrollSettings: "إعدادات المرتبات",
  employees: "العاملون (المرتبات)",
  payrollRows: "صفوف المرتبات",
  payrollClosedMonths: "الشهور المغلقة",
  teacherAbsences: "غياب المعلمين",
  feeCategories: "فئات الاشتراك",
  feeDiscounts: "الخصومات",
  feePayments: "مدفوعات الاشتراكات",
  collections: "قوائم التحصيل",
  collectionLines: "سطور التحصيل",
  examSettings: "إعدادات الاختبارات",
  competitions: "المسابقات",
  competitionLevels: "مستويات المسابقات",
  exams: "الاختبارات",
  examQuestions: "أسئلة الاختبارات",
};

export const TABLE_KEYS = Object.keys(TABLE_LABELS) as (keyof BackupData)[];

export type TableCounts = Partial<Record<keyof BackupData, number>>;

/** Rows per table (singletons count as 1 when present); empty tables are omitted. */
export function countTables(data: BackupData): TableCounts {
  const counts: TableCounts = {};
  for (const key of TABLE_KEYS) {
    const value = data[key];
    const n = Array.isArray(value) ? value.length : value ? 1 : 0;
    if (n) counts[key] = n;
  }
  return counts;
}

/** Row schema of each table, for validating rows one at a time (legacy conversion). */
export const rowSchemas = {
  settings: setting,
  members: member,
  rolePermissions: rolePermission,
  memberPermissions: memberPermission,
  studentProfiles: studentProfile,
  teacherProfiles: teacherProfile,
  places: place,
  halaqat: halaqa,
  attendance,
  recitations: recitation,
  news,
  customFields: customField,
  pendingColumns: pendingColumn,
  employees: employee,
  payrollRows: payrollRow,
  payrollClosedMonths: closedMonth,
  teacherAbsences: teacherAbsence,
  feeCategories: feeCategory,
  feeDiscounts: feeDiscount,
  feePayments: feePayment,
  collections: collection,
  collectionLines: collectionLine,
  competitions: competition,
  competitionLevels: competitionLevel,
  exams: exam,
  examQuestions: examQuestion,
} satisfies Record<BackupTable, z.ZodType>;

export const singletonSchemas = { payrollSettings, examSettings };
