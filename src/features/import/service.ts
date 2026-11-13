import "server-only";

import type { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { fixName, normalizeArabic } from "@/lib/arabic";
import { fromISODate } from "@/lib/dates";
import { type HalaqaNaming, halaqaLabel } from "@/lib/domain/halaqa";
import { type AuthContext, assertRole } from "@/server/auth";
import { db, type Tx } from "@/server/db";
import { listCustomFields } from "@/server/directory";
import { ValidationError } from "@/server/errors";
import { createMemberRecord } from "@/server/members";

import { applyField, DATE_COLUMNS, emptyPatch, type MemberPatch, patchIsEmpty, type ProfileValue } from "./apply-field";
import { type FieldTarget, fieldTargets, type ImportKind, KIND_ROLE, TARGET_HALAQA, TARGET_PIN } from "./fields";
import { halaqaQueryKeys } from "./matching";
import { type Table, parseCSV } from "./parse/csv";
import { parseSheetUrl, SHEETS_HOST, sheetCsvUrl } from "./parse/sheets";
import type { checkImportSchema, importMembersSchema } from "./schemas";

/** Bulk work hashes a password per new account, so the default 5 s transaction window is far too short. */
export const LONG_TX = { timeout: 10 * 60_000, maxWait: 20_000 };
const MAX_WARNINGS = 40;

// ───────────── Targets ─────────────

export async function listFieldTargets(auth: AuthContext, kind: ImportKind): Promise<FieldTarget[]> {
  assertRole(auth, "ADMIN");
  return fieldTargets(kind, await listCustomFields(kind));
}

// ───────────── Google Sheets ─────────────

const SHEET_ERROR = "تعذّر جلب الملف. تأكد أن مشاركته «أي شخص لديه الرابط»، أو انسخ الخلايا والصقها هنا.";
const MAX_SHEET_BYTES = 5 * 1024 * 1024;

/** Google may bounce the export between its own hosts; nothing else is followed. */
const allowedSheetHost = (host: string) => host === SHEETS_HOST || host.endsWith(".googleusercontent.com");

/**
 * Downloads a shared Google Sheet as CSV. The request URL is rebuilt from the
 * validated spreadsheet id, redirects are followed by hand and only to Google
 * hosts, and the body is size-limited — the user never controls where the
 * server connects.
 */
export async function fetchSheetTable(auth: AuthContext, rawUrl: string): Promise<Table> {
  assertRole(auth, "ADMIN");
  const ref = parseSheetUrl(rawUrl);
  if (!ref) throw new ValidationError("الرابط ليس رابط Google Sheets صالحًا.");

  let text: string;
  try {
    let url = sheetCsvUrl(ref);
    let response: Response | null = null;
    for (let hop = 0; hop < 4; hop++) {
      response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15_000), headers: { Accept: "text/csv" } });
      if (response.status < 300 || response.status >= 400) break;
      const next = new URL(response.headers.get("location") ?? "", url);
      if (next.protocol !== "https:" || !allowedSheetHost(next.hostname)) throw new Error("redirect");
      url = next.toString();
    }
    if (!response?.ok) throw new Error("status");
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > MAX_SHEET_BYTES) throw new ValidationError("الملف أكبر من المسموح (5 م.ب). قسّمه ثم أعد المحاولة.");
    text = new TextDecoder().decode(bytes);
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError(SHEET_ERROR);
  }
  // A private sheet answers with an HTML sign-in page instead of CSV.
  if (/^\s*</.test(text)) throw new ValidationError(SHEET_ERROR);
  return parseCSV(text);
}

// ───────────── Halaqa lookup ─────────────

interface HalaqaIndex {
  /** Normalised label / old name / teacher name → halaqa id. */
  byKey: Map<string, string>;
  teachersByName: Map<string, string>;
}

/** How a halaqa may be named in a file: «حلقة فلان», the teacher's name alone, or its own stored name. */
async function loadHalaqaIndex(client: Tx | typeof db): Promise<HalaqaIndex> {
  const [rows, teachers] = await Promise.all([
    client.halaqa.findMany({ include: { teacher: { select: { name: true } }, place: { select: { name: true } } } }),
    client.member.findMany({ where: { role: "TEACHER" }, select: { id: true, nameNormalized: true } }),
  ]);
  const naming: HalaqaNaming[] = rows.map((h) => ({
    id: h.id, name: h.name, teacherId: h.teacherId, teacherName: h.teacher?.name ?? null, placeId: h.placeId,
    placeName: h.place?.name ?? null, scheduleMode: h.scheduleMode, startTime: h.startTime, endTime: h.endTime,
    startPrayer: h.startPrayer, endPrayer: h.endPrayer,
  }));
  const byKey = new Map<string, string>();
  for (const h of naming) {
    for (const key of [halaqaLabel(h, naming), h.name, h.teacherName]) {
      const k = normalizeArabic(key);
      if (k && !byKey.has(k)) byKey.set(k, h.id);
    }
  }
  return { byKey, teachersByName: new Map(teachers.map((t) => [t.nameNormalized, t.id])) };
}

const findHalaqa = (index: HalaqaIndex, value: string) =>
  halaqaQueryKeys(value, normalizeArabic).map((k) => index.byKey.get(k)).find(Boolean) ?? null;

// ───────────── Preview check ─────────────

export interface ImportCheck {
  /** Normalised names that already exist for this role. */
  existingNames: string[];
  /** Halaqa cells (as written) that match no halaqa. */
  unknownHalaqat: string[];
}

export async function checkImport(auth: AuthContext, input: z.output<typeof checkImportSchema>): Promise<ImportCheck> {
  assertRole(auth, "ADMIN");
  const keys = [...new Set(input.names.map((n) => normalizeArabic(fixName(n))).filter(Boolean))];
  const existing = await db.member.findMany({
    where: { role: KIND_ROLE[input.kind], nameNormalized: { in: keys } },
    select: { nameNormalized: true },
  });
  let unknownHalaqat: string[] = [];
  if (input.kind === "STUDENTS" && input.halaqat.length) {
    const index = await loadHalaqaIndex(db);
    const seen = new Set<string>();
    unknownHalaqat = input.halaqat.filter((value) => {
      const key = normalizeArabic(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return !findHalaqa(index, value);
    });
  }
  return { existingNames: [...new Set(existing.map((m) => m.nameNormalized))], unknownHalaqat };
}

// ───────────── Applying a patch ─────────────

const profileData = (values: Record<string, ProfileValue>) =>
  Object.fromEntries(Object.entries(values).map(([k, v]) => [k, DATE_COLUMNS.has(k) ? fromISODate(String(v)) : v]));

/** Writes imported values onto an existing member and its profile. */
export async function applyPatch(tx: Tx, kind: ImportKind, memberId: string, patch: MemberPatch, halaqaId?: string | null): Promise<void> {
  if (patch.phone !== undefined || Object.keys(patch.extra).length) {
    const current = await tx.member.findUniqueOrThrow({ where: { id: memberId }, select: { extra: true } });
    const extra = { ...(current.extra as Record<string, string>), ...patch.extra };
    await tx.member.update({ where: { id: memberId }, data: { extra, ...(patch.phone !== undefined ? { phone: patch.phone } : {}) } });
  }
  if (kind === "STUDENTS") {
    const data = { ...profileData(patch.student), ...(halaqaId ? { halaqaId } : {}) } as Prisma.StudentProfileUncheckedUpdateInput;
    if (Object.keys(data).length) {
      await tx.studentProfile.upsert({
        where: { memberId },
        update: data,
        create: { ...(data as Prisma.StudentProfileUncheckedCreateInput), memberId },
      });
    }
  } else if (Object.keys(patch.teacher).length) {
    const data = profileData(patch.teacher) as Prisma.TeacherProfileUncheckedUpdateInput;
    await tx.teacherProfile.upsert({
      where: { memberId },
      update: data,
      create: { ...(data as Prisma.TeacherProfileUncheckedCreateInput), memberId },
    });
  }
}

// ───────────── Import ─────────────

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  halaqatCreated: number;
  pendingColumns: number;
  /** Generated passwords — shown once, never stored in plain text. */
  credentials: { name: string; password: string }[];
  warnings: string[];
}

export interface PendingValue {
  memberId: string;
  name: string;
  value: string;
}

/**
 * Imports a reviewed spreadsheet in one transaction: new members get an
 * account (password from the file or generated), matched columns land in
 * their fields, and unmatched columns are kept as pending columns.
 */
export async function importMembers(auth: AuthContext, input: z.output<typeof importMembersSchema>): Promise<ImportResult> {
  assertRole(auth, "ADMIN");
  const { kind, columns, rows } = input;
  const role = KIND_ROLE[kind];

  const targets = fieldTargets(kind, await listCustomFields(kind));
  const labels = new Map(targets.map((t) => [t.id, t.label]));
  const chosen = columns.flatMap((c) => (c.target ? [c.target] : []));
  if (chosen.some((id) => !labels.has(id))) throw new ValidationError("أحد الأعمدة مربوط بحقل غير موجود. أعد المعاينة.");
  if (new Set(chosen).size !== chosen.length) throw new ValidationError("لا يُربط عمودان بالحقل نفسه.");
  if (rows.some((r) => r.values.length !== columns.length)) throw new ValidationError("بيانات الملف غير متسقة. أعد المعاينة.");

  const result: ImportResult = { created: 0, updated: 0, skipped: 0, halaqatCreated: 0, pendingColumns: 0, credentials: [], warnings: [] };
  const warn = (message: string) => {
    if (result.warnings.length < MAX_WARNINGS) result.warnings.push(message);
  };

  await db.$transaction(async (tx) => {
    const existing = await tx.member.findMany({ where: { role }, select: { id: true, nameNormalized: true } });
    const byName = new Map(existing.map((m) => [m.nameNormalized, m.id]));
    const halaqat = kind === "STUDENTS" ? await loadHalaqaIndex(tx) : null;
    const seen = new Set<string>();
    const pending: PendingValue[][] = columns.map(() => []);

    const resolveHalaqa = async (value: string): Promise<string | null> => {
      if (!halaqat || !value.trim()) return null;
      const found = findHalaqa(halaqat, value);
      if (found || !input.createHalaqat) return found;
      // A new halaqa: when a teacher carries that name it is linked to them and takes their name.
      const keys = halaqaQueryKeys(value, normalizeArabic);
      const teacherId = keys.map((k) => halaqat.teachersByName.get(k)).find(Boolean) ?? null;
      const name = teacherId ? "" : /^\s*حلقة/.test(value) ? value.trim() : `حلقة ${value.trim()}`;
      const created = await tx.halaqa.create({ data: { name, teacherId }, select: { id: true } });
      for (const k of keys) halaqat.byKey.set(k, created.id);
      result.halaqatCreated++;
      return created.id;
    };

    for (const row of rows) {
      const name = fixName(row.name);
      const key = normalizeArabic(name);
      if (!key) continue;
      const existingId = byName.get(key);
      // A name repeated inside the file, or already registered, is ignored unless updating was requested.
      if (seen.has(key) || (existingId && input.onDuplicate === "skip")) {
        result.skipped++;
        continue;
      }
      seen.add(key);

      const patch = emptyPatch();
      let pin = "";
      let halaqaValue = "";
      columns.forEach((column, i) => {
        const value = row.values[i];
        if (!column.target || !value) return;
        if (column.target === TARGET_PIN) pin = value.trim().slice(0, 72);
        else if (column.target === TARGET_HALAQA) halaqaValue = value;
        else if (!applyField(patch, column.target, value)) {
          warn(`«${name}»: القيمة «${value.slice(0, 40)}» لا تصلح لحقل «${labels.get(column.target)}» فتُركت`);
        }
      });
      const halaqaId = await resolveHalaqa(halaqaValue);
      if (halaqaValue.trim() && kind === "STUDENTS" && !halaqaId) warn(`«${name}»: الحلقة «${halaqaValue.trim()}» غير موجودة فبقي بلا حلقة`);

      let memberId: string;
      if (existingId) {
        // Passwords of existing accounts are never changed by an import.
        memberId = existingId;
        if (!patchIsEmpty(patch) || halaqaId) await applyPatch(tx, kind, memberId, patch, halaqaId);
        result.updated++;
      } else {
        const created = await createMemberRecord(tx, { role, name, phone: patch.phone, password: pin || undefined, extra: patch.extra });
        memberId = created.id;
        byName.set(key, memberId);
        await applyPatch(tx, kind, memberId, { ...patch, phone: undefined, extra: {} }, halaqaId);
        if (!pin && created.password) result.credentials.push({ name: created.name, password: created.password });
        result.created++;
      }

      columns.forEach((column, i) => {
        if (!column.target && row.values[i]) pending[i].push({ memberId, name, value: row.values[i] });
      });
    }

    for (const [i, values] of pending.entries()) {
      if (!values.length) continue;
      await tx.pendingColumn.create({ data: { kind, header: columns[i].header, values: values as unknown as Prisma.InputJsonValue } });
      result.pendingColumns++;
    }
  }, LONG_TX);

  return result;
}
