import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { fixName, normalizeArabic } from "@/lib/arabic";
import { fromISODate, toISODate } from "@/lib/dates";
import type { Tx } from "@/server/db";

import { type BackupData, backupDataSchema, type BackupTable, type TableCounts } from "./format";

/**
 * Database ⇄ backup-format plumbing. The format mirrors the Prisma models
 * field for field, so rows convert generically: only dates and decimals
 * change representation.
 */

const DATE_ONLY: ReadonlySet<string> = new Set(["date", "birthDate", "joinDate", "statusDate"]);
const TIMESTAMPS: ReadonlySet<string> = new Set(["createdAt", "sentAt", "reviewedAt"]);

type Row = Record<string, unknown>;

function fromDb(row: Row): Row {
  const out: Row = {};
  for (const [key, value] of Object.entries(row)) {
    if (value instanceof Date) out[key] = DATE_ONLY.has(key) ? toISODate(value) : value.toISOString();
    else if (Prisma.Decimal.isDecimal(value)) out[key] = Number(value);
    else out[key] = value;
  }
  return out;
}

function toDb(row: Row): Row {
  const out: Row = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === undefined) continue;
    if (typeof value === "string" && DATE_ONLY.has(key)) out[key] = fromISODate(value);
    else if (typeof value === "string" && TIMESTAMPS.has(key)) out[key] = new Date(value);
    else out[key] = value;
  }
  return out;
}

/** Reads every table (inside the given transaction, for a consistent snapshot). */
export async function readAll(tx: Tx): Promise<BackupData> {
  const many = async (rows: Promise<Row[]>) => (await rows).map(fromDb);
  const one = async (row: Promise<Row | null>) => {
    const r = await row;
    return r ? fromDb(r) : null;
  };
  const raw = {
    settings: await many(tx.setting.findMany({ orderBy: { key: "asc" } })),
    members: await many(tx.member.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }, { id: "asc" }] })),
    rolePermissions: await many(tx.rolePermission.findMany({ orderBy: [{ role: "asc" }, { permission: "asc" }] })),
    memberPermissions: await many(tx.memberPermission.findMany({ orderBy: [{ memberId: "asc" }, { permission: "asc" }] })),
    studentProfiles: await many(tx.studentProfile.findMany({ orderBy: { memberId: "asc" } })),
    teacherProfiles: await many(tx.teacherProfile.findMany({ orderBy: { memberId: "asc" } })),
    places: await many(tx.place.findMany({ orderBy: { name: "asc" } })),
    halaqat: await many(tx.halaqa.findMany({ orderBy: { id: "asc" } })),
    attendance: await many(tx.attendance.findMany({ orderBy: [{ date: "asc" }, { id: "asc" }] })),
    recitations: await many(tx.recitation.findMany({ orderBy: [{ date: "asc" }, { id: "asc" }] })),
    news: await many(tx.news.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] })),
    customFields: await many(tx.customField.findMany({ orderBy: [{ kind: "asc" }, { key: "asc" }] })),
    pendingColumns: await many(tx.pendingColumn.findMany({ orderBy: { id: "asc" } })),
    payrollSettings: await one(tx.payrollSettings.findUnique({ where: { id: 1 } })),
    employees: await many(tx.employee.findMany({ orderBy: [{ name: "asc" }, { id: "asc" }] })),
    payrollRows: await many(tx.payrollRow.findMany({ orderBy: [{ year: "asc" }, { month: "asc" }, { id: "asc" }] })),
    payrollClosedMonths: await many(tx.payrollClosedMonth.findMany({ orderBy: [{ year: "asc" }, { month: "asc" }] })),
    teacherAbsences: await many(tx.teacherAbsence.findMany({ orderBy: [{ date: "asc" }, { id: "asc" }] })),
    feeCategories: await many(tx.feeCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] })),
    feeDiscounts: await many(tx.feeDiscount.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] })),
    feePayments: await many(tx.feePayment.findMany({ orderBy: [{ year: "asc" }, { month: "asc" }, { id: "asc" }] })),
    collections: await many(tx.collection.findMany({ orderBy: [{ year: "asc" }, { month: "asc" }, { id: "asc" }] })),
    collectionLines: await many(tx.collectionLine.findMany({ orderBy: { id: "asc" } })),
    examSettings: await one(tx.examSettings.findUnique({ where: { id: 1 } })),
    competitions: await many(tx.competition.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] })),
    competitionLevels: await many(tx.competitionLevel.findMany({ orderBy: { id: "asc" } })),
    exams: await many(tx.exam.findMany({ orderBy: [{ date: "asc" }, { id: "asc" }] })),
    examQuestions: await many(tx.examQuestion.findMany({ orderBy: [{ examId: "asc" }, { position: "asc" }] })),
  };
  // Parsing strips columns that are not part of the format (nameNormalized, updatedAt, singleton ids)
  // and guarantees that what is exported can be restored.
  return backupDataSchema.parse(raw);
}

/** Empties every table, children before parents. Sessions go with their members. */
export async function wipeAll(tx: Tx): Promise<void> {
  await tx.examQuestion.deleteMany();
  await tx.exam.deleteMany();
  await tx.competitionLevel.deleteMany();
  await tx.competition.deleteMany();
  await tx.examSettings.deleteMany();
  await tx.collectionLine.deleteMany();
  await tx.collection.deleteMany();
  await tx.feePayment.deleteMany();
  await tx.teacherAbsence.deleteMany();
  await tx.payrollClosedMonth.deleteMany();
  await tx.payrollRow.deleteMany();
  await tx.employee.deleteMany();
  await tx.payrollSettings.deleteMany();
  await tx.pendingColumn.deleteMany();
  await tx.customField.deleteMany();
  await tx.news.deleteMany();
  await tx.recitation.deleteMany();
  await tx.attendance.deleteMany();
  await tx.session.deleteMany();
  await tx.memberPermission.deleteMany();
  await tx.rolePermission.deleteMany();
  await tx.studentProfile.deleteMany();
  await tx.teacherProfile.deleteMany();
  await tx.halaqa.deleteMany();
  await tx.member.deleteMany();
  await tx.feeDiscount.deleteMany();
  await tx.feeCategory.deleteMany();
  await tx.place.deleteMany();
  await tx.setting.deleteMany();
}

// Rows are validated by the backup schema, whose fields mirror the Prisma create inputs,
// so the generic rows are handed to createMany as-is (`as never`).
type Insert = (tx: Tx, data: Row[], skipDuplicates: boolean) => Promise<{ count: number }>;

/** Tables in insertion order (parents first) with a batch size that keeps statements reasonable. */
const INSERTS: ReadonlyArray<[BackupTable, number, Insert]> = [
  ["settings", 50, (tx, data, skipDuplicates) => tx.setting.createMany({ data: data as never, skipDuplicates })],
  ["places", 500, (tx, data, skipDuplicates) => tx.place.createMany({ data: data as never, skipDuplicates })],
  ["feeCategories", 500, (tx, data, skipDuplicates) => tx.feeCategory.createMany({ data: data as never, skipDuplicates })],
  ["feeDiscounts", 500, (tx, data, skipDuplicates) => tx.feeDiscount.createMany({ data: data as never, skipDuplicates })],
  // Small batches: members carry their photo.
  ["members", 50, (tx, data, skipDuplicates) => tx.member.createMany({ data: data as never, skipDuplicates })],
  ["rolePermissions", 500, (tx, data, skipDuplicates) => tx.rolePermission.createMany({ data: data as never, skipDuplicates })],
  ["memberPermissions", 500, (tx, data, skipDuplicates) => tx.memberPermission.createMany({ data: data as never, skipDuplicates })],
  ["halaqat", 500, (tx, data, skipDuplicates) => tx.halaqa.createMany({ data: data as never, skipDuplicates })],
  ["studentProfiles", 300, (tx, data, skipDuplicates) => tx.studentProfile.createMany({ data: data as never, skipDuplicates })],
  ["teacherProfiles", 300, (tx, data, skipDuplicates) => tx.teacherProfile.createMany({ data: data as never, skipDuplicates })],
  ["attendance", 2000, (tx, data, skipDuplicates) => tx.attendance.createMany({ data: data as never, skipDuplicates })],
  ["recitations", 2000, (tx, data, skipDuplicates) => tx.recitation.createMany({ data: data as never, skipDuplicates })],
  ["news", 500, (tx, data, skipDuplicates) => tx.news.createMany({ data: data as never, skipDuplicates })],
  ["customFields", 500, (tx, data, skipDuplicates) => tx.customField.createMany({ data: data as never, skipDuplicates })],
  ["pendingColumns", 20, (tx, data, skipDuplicates) => tx.pendingColumn.createMany({ data: data as never, skipDuplicates })],
  ["employees", 500, (tx, data, skipDuplicates) => tx.employee.createMany({ data: data as never, skipDuplicates })],
  ["payrollRows", 1000, (tx, data, skipDuplicates) => tx.payrollRow.createMany({ data: data as never, skipDuplicates })],
  ["payrollClosedMonths", 500, (tx, data, skipDuplicates) => tx.payrollClosedMonth.createMany({ data: data as never, skipDuplicates })],
  ["teacherAbsences", 1000, (tx, data, skipDuplicates) => tx.teacherAbsence.createMany({ data: data as never, skipDuplicates })],
  ["feePayments", 2000, (tx, data, skipDuplicates) => tx.feePayment.createMany({ data: data as never, skipDuplicates })],
  ["collections", 1000, (tx, data, skipDuplicates) => tx.collection.createMany({ data: data as never, skipDuplicates })],
  ["collectionLines", 2000, (tx, data, skipDuplicates) => tx.collectionLine.createMany({ data: data as never, skipDuplicates })],
  ["competitions", 500, (tx, data, skipDuplicates) => tx.competition.createMany({ data: data as never, skipDuplicates })],
  ["competitionLevels", 500, (tx, data, skipDuplicates) => tx.competitionLevel.createMany({ data: data as never, skipDuplicates })],
  ["exams", 1000, (tx, data, skipDuplicates) => tx.exam.createMany({ data: data as never, skipDuplicates })],
  ["examQuestions", 2000, (tx, data, skipDuplicates) => tx.examQuestion.createMany({ data: data as never, skipDuplicates })],
];

/**
 * Inserts a whole data set. With `skipDuplicates` (merge) rows that collide
 * with an existing primary key or unique constraint are left as they are.
 * Returns how many rows were actually inserted per table.
 */
export async function insertAll(tx: Tx, data: BackupData, skipDuplicates: boolean): Promise<TableCounts> {
  const inserted: TableCounts = {};
  for (const [table, batch, insert] of INSERTS) {
    let rows = (data[table] as Row[]).map(toDb);
    if (table === "members") {
      rows = rows.map((m) => ({ ...m, name: fixName(String(m.name)), nameNormalized: normalizeArabic(fixName(String(m.name))) }));
    }
    let count = 0;
    for (let i = 0; i < rows.length; i += batch) count += (await insert(tx, rows.slice(i, i + batch), skipDuplicates)).count;
    if (count) inserted[table] = count;
  }
  if (data.payrollSettings) {
    const { count } = await tx.payrollSettings.createMany({ data: [{ ...data.payrollSettings, id: 1 }], skipDuplicates });
    if (count) inserted.payrollSettings = count;
  }
  if (data.examSettings) {
    const { count } = await tx.examSettings.createMany({ data: [{ ...data.examSettings, id: 1 }], skipDuplicates });
    if (count) inserted.examSettings = count;
  }
  return inserted;
}
