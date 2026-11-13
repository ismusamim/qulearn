/**
 * Pure conversion of one imported cell into a change on the new schema:
 * which table/column it lands in and how the text is turned into a typed
 * value. The service applies the resulting patch with Prisma.
 */
import { normalizePhone, toLatinDigits } from "@/lib/arabic";
import { type ISODate, isISODate } from "@/lib/dates";

import { columnTarget, EXTRA_PREFIX, TARGET_PHONE, type ValueType } from "./fields";

export type ProfileValue = string | number;

export interface MemberPatch {
  phone?: string;
  /** Custom-field values to merge into Member.extra. */
  extra: Record<string, string>;
  /** StudentProfile columns. Dates are ISO strings. */
  student: Record<string, ProfileValue>;
  /** TeacherProfile columns. Dates are ISO strings. */
  teacher: Record<string, ProfileValue>;
}

export const emptyPatch = (): MemberPatch => ({ extra: {}, student: {}, teacher: {} });

export const DATE_COLUMNS: ReadonlySet<string> = new Set(["birthDate", "joinDate"]);

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Dates as people type them in sheets: 2012-03-25, 25/3/2012, 25-03-2012, or
 * the serial number Excel stores for a date cell. Null when not a date.
 */
export function parseLooseDate(raw: string): ISODate | null {
  const v = toLatinDigits(raw).trim();
  let iso: string | null = null;
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(v);
  if (m) iso = `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  else if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(v))) iso = `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  else if (/^\d{4,5}(\.\d+)?$/.test(v)) {
    // Excel serial: days since 1899-12-30. Limited to plausible years (1927–2119).
    const serial = Math.floor(Number(v));
    if (serial >= 10000 && serial <= 80000) iso = new Date(Date.UTC(1899, 11, 30) + serial * 86400000).toISOString().slice(0, 10);
  }
  return iso && isISODate(iso) ? iso : null;
}

function parseNumber(raw: string): number | null {
  const v = toLatinDigits(raw).replace(/[,\s٬]/g, "").replace("٫", ".");
  if (!/^-?\d+(\.\d+)?$/.test(v)) return null;
  return Number(v);
}

const TEACHER_STATUS: Record<string, string> = { نشط: "ACTIVE", "في إجازة": "ON_LEAVE", إجازة: "ON_LEAVE", موقوف: "SUSPENDED" };

function convert(type: ValueType, raw: string): ProfileValue | null {
  switch (type) {
    case "text":
      return raw;
    case "phone":
      return normalizePhone(raw) || null;
    case "date":
      return parseLooseDate(raw);
    case "int": {
      const n = parseNumber(raw);
      return n != null && Number.isInteger(n) && n >= 0 && n <= 1000 ? n : null;
    }
    case "money": {
      const n = parseNumber(raw);
      return n != null && n >= 0 && n < 1e10 ? Math.round(n * 100) / 100 : null;
    }
    case "teacherStatus":
      return TEACHER_STATUS[raw.replace(/\s+/g, " ").trim()] ?? null;
  }
}

/**
 * Adds one value to the patch. Returns false when the value cannot be stored
 * in that field (e.g. text in a date column) — the caller reports it.
 * `core:halaqa` and `core:pin` are not handled here: they need the database.
 */
export function applyField(patch: MemberPatch, targetId: string, rawValue: string): boolean {
  const value = rawValue.trim();
  if (!value) return true;
  if (targetId === TARGET_PHONE) {
    // Keep what was typed when it has no digits at all, as the old app did.
    patch.phone = normalizePhone(value) || value;
    return true;
  }
  if (targetId.startsWith(EXTRA_PREFIX)) {
    patch.extra[targetId.slice(EXTRA_PREFIX.length)] = value;
    return true;
  }
  const target = columnTarget(targetId);
  if (!target) return false;
  const converted = convert(target.type, value);
  if (converted == null) return false;
  patch[target.scope][target.column] = converted;
  return true;
}

export const patchIsEmpty = (p: MemberPatch) =>
  p.phone === undefined && !Object.keys(p.extra).length && !Object.keys(p.student).length && !Object.keys(p.teacher).length;
