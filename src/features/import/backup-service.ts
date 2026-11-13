import "server-only";

import { fixName, normalizeArabic } from "@/lib/arabic";
import { todayISO } from "@/lib/dates";
import { type AuthContext, assertRole } from "@/server/auth";
import { hashPassword } from "@/server/auth/password";
import { db } from "@/server/db";
import { ValidationError } from "@/server/errors";

import { keepCurrentAdmin, remapIds } from "./backup/current-admin";
import {
  BACKUP_FORMAT, BACKUP_VERSION, type BackupData, type BackupDocument, backupDocumentSchema, countTables, TABLE_KEYS,
  type TableCounts,
} from "./backup/format";
import { normalizeBackup } from "./backup/integrity";
import { convertLegacyBackup, isLegacyBackup } from "./backup/legacy";
import { type BackupReport, ReportBuilder } from "./backup/report";
import { insertAll, readAll, wipeAll } from "./backup/store";
import { type BackupStrategy, REPLACE_PHRASE } from "./schemas";

const LONG_TX = { timeout: 15 * 60_000, maxWait: 20_000 };

// ───────────── Export ─────────────

/** The whole database as one backup document. Passwords leave only as hashes; sessions are not exported. */
export async function exportBackup(auth: AuthContext): Promise<BackupDocument> {
  assertRole(auth, "ADMIN");
  const data = await db.$transaction((tx) => readAll(tx), { ...LONG_TX, isolationLevel: "RepeatableRead" });
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data };
}

// ───────────── Reading a file ─────────────

export type BackupSource = "qulearn" | "legacy";

interface LoadedBackup {
  source: BackupSource;
  exportedAt: string | null;
  data: BackupData;
  /** Plain passwords from an old-app backup, by member id. */
  pins: Record<string, string>;
  payrollPin: string | null;
  report: ReportBuilder;
}

const NOT_A_BACKUP = "هذا الملف ليس نسخة احتياطية من التطبيق";

/** Recognises the file (new format or old app), validates it and makes it internally consistent. */
function loadBackup(raw: unknown): LoadedBackup {
  const report = new ReportBuilder();
  const doc = (raw ?? {}) as Record<string, unknown>;
  if (typeof raw === "object" && raw !== null && doc.format === BACKUP_FORMAT) {
    if (doc.version !== BACKUP_VERSION) {
      throw new ValidationError(`إصدار النسخة (${String(doc.version)}) غير مدعوم في هذا الإصدار من التطبيق`);
    }
    const parsed = backupDocumentSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ValidationError(`النسخة تالفة عند «${issue?.path.join(".") ?? ""}»: ${issue?.message ?? ""}`);
    }
    return {
      source: "qulearn",
      exportedAt: parsed.data.exportedAt,
      data: normalizeBackup(parsed.data.data, report),
      pins: {},
      payrollPin: null,
      report,
    };
  }
  if (isLegacyBackup(raw)) {
    const converted = convertLegacyBackup(raw, { today: todayISO() });
    for (const s of converted.report.skipped) report.skip(s.table, s.reason, s.count);
    for (const n of converted.report.notes) report.note(n);
    return { source: "legacy", exportedAt: null, data: converted.data, pins: converted.pins, payrollPin: converted.payrollPin, report };
  }
  throw new ValidationError(NOT_A_BACKUP);
}

const toReport = (loaded: LoadedBackup): BackupReport => ({
  counts: countTables(loaded.data),
  skipped: loaded.report.skipped,
  notes: loaded.report.notes,
});

export interface BackupAnalysis {
  source: BackupSource;
  exportedAt: string | null;
  report: BackupReport;
}

/** What the file contains and what would be left out — shown before anything is written. */
export async function analyzeBackup(auth: AuthContext, raw: unknown): Promise<BackupAnalysis> {
  assertRole(auth, "ADMIN");
  const loaded = loadBackup(raw);
  return { source: loaded.source, exportedAt: loaded.exportedAt, report: toReport(loaded) };
}

// ───────────── Passwords ─────────────

/**
 * Old backups carry plain passwords; they are hashed here and never stored
 * as text. Equal passwords (the old default «0000») share one hash so a big
 * import does not spend a minute hashing the same value.
 */
async function hashPins(loaded: LoadedBackup, skip: ReadonlySet<string> = new Set()): Promise<BackupData> {
  const cache = new Map<string, string>();
  const hash = async (pin: string) => {
    let h = cache.get(pin);
    if (!h) cache.set(pin, (h = await hashPassword(pin)));
    return h;
  };
  const members: BackupData["members"] = [];
  for (const m of loaded.data.members) {
    const pin = loaded.pins[m.id];
    members.push(pin && !m.passwordHash && !skip.has(m.id) ? { ...m, passwordHash: await hash(pin) } : m);
  }
  const payrollSettings =
    loaded.data.payrollSettings && loaded.payrollPin && !loaded.data.payrollSettings.pinHash
      ? { ...loaded.data.payrollSettings, pinHash: await hash(loaded.payrollPin) }
      : loaded.data.payrollSettings;
  return { ...loaded.data, members, payrollSettings };
}

// ───────────── Apply ─────────────

export interface BackupApplyResult {
  source: BackupSource;
  strategy: BackupStrategy;
  /** Rows written, per table. */
  inserted: TableCounts;
  /** Rows of the file that were already in the database (merge only). */
  alreadyThere: TableCounts;
  report: BackupReport;
}

function difference(total: TableCounts, inserted: TableCounts): TableCounts {
  const out: TableCounts = {};
  for (const key of TABLE_KEYS) {
    const n = (total[key] ?? 0) - (inserted[key] ?? 0);
    if (n > 0) out[key] = n;
  }
  return out;
}

/**
 * «استبدال الكل»: the database is emptied and refilled from the file in one
 * transaction. The admin doing it keeps their account, password and session.
 */
async function replaceAll(auth: AuthContext, loaded: LoadedBackup): Promise<TableCounts> {
  const me = await db.member.findUniqueOrThrow({ where: { id: auth.memberId } });
  const hashed = await hashPins(loaded);
  const kept = keepCurrentAdmin(hashed, {
    id: me.id,
    role: me.role,
    name: me.name,
    phone: me.phone,
    passwordHash: me.passwordHash,
    photo: me.photo,
    extra: (me.extra ?? {}) as Record<string, string>,
    createdAt: me.createdAt.toISOString(),
  });
  const data = normalizeBackup(kept, loaded.report);
  return db.$transaction(async (tx) => {
    const session = await tx.session.findUnique({ where: { id: auth.sessionId } });
    await wipeAll(tx);
    const inserted = await insertAll(tx, data, false);
    if (session) await tx.session.create({ data: session });
    return inserted;
  }, LONG_TX);
}

const nameKey = (name: string) => normalizeArabic(fixName(name));

/**
 * «دمج» step 1: rows of the file that already exist in the database under
 * another id (same person and role, same place name…) are pointed at the
 * existing row, so nothing is duplicated and their children attach to it.
 */
async function alignWithDatabase(loaded: LoadedBackup): Promise<{ existingMembers: Set<string> }> {
  const apply = (map: Map<string, string>) => {
    if (!map.size) return;
    const next = remapIds({ data: loaded.data, pins: loaded.pins }, map);
    loaded.data = next.data;
    loaded.pins = next.pins;
  };
  const matchBy = <T extends { id: string }>(rows: T[], existing: T[], key: (row: T) => string | null, map: Map<string, string>) => {
    const ids = new Set(existing.map((e) => e.id));
    const byKey = new Map<string, string>();
    for (const e of existing) {
      const k = key(e);
      if (k && !byKey.has(k)) byKey.set(k, e.id);
    }
    for (const row of rows) {
      const k = key(row);
      const hit = k ? byKey.get(k) : undefined;
      if (!ids.has(row.id) && hit) map.set(row.id, hit);
    }
  };

  const [members, places, categories, discounts, employees, competitions] = await Promise.all([
    db.member.findMany({ select: { id: true, role: true, name: true } }),
    db.place.findMany({ select: { id: true, name: true } }),
    db.feeCategory.findMany({ select: { id: true, name: true } }),
    db.feeDiscount.findMany({ select: { id: true, name: true } }),
    db.employee.findMany({ select: { id: true, name: true } }),
    db.competition.findMany({ select: { id: true, name: true } }),
  ]);
  const first = new Map<string, string>();
  matchBy(loaded.data.members, members, (m) => `${m.role}|${nameKey(m.name)}`, first);
  matchBy(loaded.data.places, places, (p) => p.name.trim(), first);
  matchBy(loaded.data.feeCategories, categories, (c) => c.name.trim() || null, first);
  matchBy(loaded.data.feeDiscounts, discounts, (d) => d.name.trim() || null, first);
  matchBy(loaded.data.employees, employees, (e) => nameKey(e.name), first);
  matchBy(loaded.data.competitions, competitions, (c) => c.name.trim() || null, first);
  apply(first);

  // Rows identified through their parents, now that parents carry database ids.
  const [halaqat, levels] = await Promise.all([
    db.halaqa.findMany({ select: { id: true, name: true, teacherId: true, placeId: true } }),
    db.competitionLevel.findMany({ select: { id: true, name: true, competitionId: true } }),
  ]);
  const second = new Map<string, string>();
  matchBy(loaded.data.halaqat, halaqat, (h) => (h.teacherId ? `${h.teacherId}|${h.placeId}|${h.name.trim()}` : null), second);
  matchBy(loaded.data.competitionLevels, levels, (l) => `${l.competitionId}|${l.name.trim()}`, second);
  apply(second);

  const collections = await db.collection.findMany({ select: { id: true, teacherId: true, halaqaId: true, year: true, month: true } });
  const third = new Map<string, string>();
  matchBy(loaded.data.collections, collections, (c) => `${c.teacherId}|${c.halaqaId}|${c.year}|${c.month}`, third);
  apply(third);

  // Two rows of the file may now be the same row; settle that before inserting.
  loaded.data = normalizeBackup(loaded.data, loaded.report);

  // Unique values the database already holds for another row are dropped rather than failing the import.
  const memberIds = new Set(members.map((m) => m.id));
  const [nationalIds, defaults, linked] = await Promise.all([
    db.studentProfile.findMany({ where: { nationalId: { not: null } }, select: { memberId: true, nationalId: true } }),
    db.feeCategory.findMany({ where: { defaultFor: { not: null } }, select: { id: true, defaultFor: true } }),
    db.employee.findMany({ where: { memberId: { not: null } }, select: { id: true, memberId: true } }),
  ]);
  const nidOwner = new Map(nationalIds.map((p) => [p.nationalId, p.memberId]));
  const defaultOwner = new Map(defaults.map((c) => [c.defaultFor, c.id]));
  const linkOwner = new Map(linked.map((e) => [e.memberId, e.id]));
  loaded.data = {
    ...loaded.data,
    studentProfiles: loaded.data.studentProfiles.map((p) => {
      const owner = p.nationalId ? nidOwner.get(p.nationalId) : undefined;
      if (!owner || owner === p.memberId) return p;
      loaded.report.note(`الرقم القومي ${p.nationalId} مسجّل لطالب آخر فلم يُستورد مع صاحبه في الملف`);
      return { ...p, nationalId: null };
    }),
    feeCategories: loaded.data.feeCategories.map((c) =>
      c.defaultFor && defaultOwner.has(c.defaultFor) && defaultOwner.get(c.defaultFor) !== c.id ? { ...c, defaultFor: null } : c,
    ),
    employees: loaded.data.employees.map((e) =>
      e.memberId && linkOwner.has(e.memberId) && linkOwner.get(e.memberId) !== e.id ? { ...e, memberId: null } : e,
    ),
  };
  return { existingMembers: memberIds };
}

/** «دمج»: adds what the database does not have yet; existing rows are never modified. */
async function mergeInto(loaded: LoadedBackup): Promise<TableCounts> {
  const { existingMembers } = await alignWithDatabase(loaded);
  const data = await hashPins(loaded, existingMembers);
  return db.$transaction(async (tx) => {
    const inserted = await insertAll(tx, data, true);
    // An account that already existed without its profile row gets one, so every student / teacher has a profile.
    const [students, teachers] = await Promise.all([
      tx.member.findMany({ where: { role: "STUDENT", studentProfile: null }, select: { id: true } }),
      tx.member.findMany({ where: { role: "TEACHER", teacherProfile: null }, select: { id: true } }),
    ]);
    if (students.length) await tx.studentProfile.createMany({ data: students.map((m) => ({ memberId: m.id })), skipDuplicates: true });
    if (teachers.length) await tx.teacherProfile.createMany({ data: teachers.map((m) => ({ memberId: m.id })), skipDuplicates: true });
    return inserted;
  }, LONG_TX);
}

export async function applyBackup(
  auth: AuthContext,
  raw: unknown,
  options: { strategy: BackupStrategy; confirmation: string },
): Promise<BackupApplyResult> {
  assertRole(auth, "ADMIN");
  if (options.strategy === "replace" && normalizeArabic(options.confirmation) !== normalizeArabic(REPLACE_PHRASE)) {
    throw new ValidationError(`للتأكيد اكتب «${REPLACE_PHRASE}» كما هي`);
  }
  const loaded = loadBackup(raw);
  const inserted = options.strategy === "replace" ? await replaceAll(auth, loaded) : await mergeInto(loaded);
  const report = toReport(loaded);
  return {
    source: loaded.source,
    strategy: options.strategy,
    inserted,
    alreadyThere: options.strategy === "merge" ? difference(report.counts, inserted) : {},
    report,
  };
}
