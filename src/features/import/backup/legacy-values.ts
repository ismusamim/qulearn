/**
 * Value conversions from the old app's loosely typed JSON (everything may be
 * a string, a number, "" or missing) to the typed backup format.
 */
import { isISODate } from "@/lib/dates";
import { isHexColor, type ThemeColors } from "@/lib/theme";

export type Loose = Record<string, unknown>;

export const obj = (v: unknown): Loose => (v && typeof v === "object" && !Array.isArray(v) ? (v as Loose) : {});
export const arr = (v: unknown): Loose[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object").map((x) => x as Loose) : []);

export const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : "");
export const strOrNull = (v: unknown): string | null => str(v).trim() || null;

export function num(v: unknown): number | null {
  if (v === "" || v == null || typeof v === "boolean") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function int(v: unknown): number | null {
  const n = num(v);
  return n != null && Number.isInteger(n) ? n : null;
}

/** "2024-03-05" (or a timestamp starting with it) → ISO date. */
export function date(v: unknown): string | null {
  const s = str(v).trim().slice(0, 10);
  return isISODate(s) ? s : null;
}

export function timestamp(v: unknown): string | null {
  const s = str(v).trim();
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

const pick = <T extends string>(map: Record<string, T>, v: unknown): T | null => map[str(v).trim()] ?? null;

export const attendanceStatus = (v: unknown) =>
  pick({ present: "PRESENT", late: "LATE", excused: "EXCUSED", absent: "ABSENT" } as const, v);
export const recitationType = (v: unknown) => pick({ حفظ: "HIFZ", مراجعة: "REVIEW", تثبيت: "CONSOLIDATION" } as const, v);
export const placeType = (v: unknown) => (pick({ مسجد: "MOSQUE", "دار تحفيظ": "DAR" } as const, v) ?? "MOSQUE");
export const teacherStatus = (v: unknown) =>
  pick({ نشط: "ACTIVE", "في إجازة": "ON_LEAVE", موقوف: "SUSPENDED" } as const, v) ?? "ACTIVE";
export const employeeStatus = (v: unknown) => (str(v).trim() === "متوقف" ? "STOPPED" : "ACTIVE");
export const examType = (v: unknown) =>
  pick({ follow: "FOLLOW_UP", periodic: "PERIODIC", mastery: "MASTERY", comp: "COMPETITION" } as const, v);
export const collectionStatus = (v: unknown) =>
  pick({ draft: "DRAFT", sent: "SENT", returned: "RETURNED", done: "DONE" } as const, v) ?? "DRAFT";
export const lineState = (v: unknown) => pick({ pending: "PENDING", ok: "OK", issue: "ISSUE" } as const, v) ?? "PENDING";
export const discountType = (v: unknown) => (str(v).trim() === "amt" ? "AMOUNT" : "PERCENT");
export const fieldType = (v: unknown) =>
  pick({ text: "TEXT", number: "NUMBER", date: "DATE", textarea: "TEXTAREA" } as const, v) ?? "TEXT";
export const fieldKind = (v: unknown) => pick({ students: "STUDENTS", teachers: "TEACHERS" } as const, v);
export const absencePermission = (v: unknown) =>
  pick({ بإذن: "WITH_PERMISSION", "بغير إذن": "WITHOUT_PERMISSION", "بدون إذن": "WITHOUT_PERMISSION" } as const, v);
export const absenceProof = (v: unknown) => pick({ رصيد: "BALANCE", مثبت: "PROVEN" } as const, v);
export const newsAudience = (v: unknown) =>
  pick(
    { all: "ALL", admin: "ADMIN", supervisor: "SUPERVISOR", teacher: "TEACHER", student: "STUDENT", accountant: "ACCOUNTANT" } as const,
    v,
  ) ?? "ALL";

/** Old colour names → the new theme keys («stripe» has no equivalent). */
const THEME_KEYS: Record<string, keyof ThemeColors> = {
  navy: "primary", gold: "accent", bg: "background", text: "text", leaf: "success", amber: "warning", red: "danger",
};

export function theme(v: unknown): Partial<ThemeColors> {
  const out: Partial<ThemeColors> = {};
  for (const [oldKey, value] of Object.entries(obj(v))) {
    const key = THEME_KEYS[oldKey];
    if (key && isHexColor(value)) out[key] = value;
  }
  return out;
}

const PRAYER_RE = /بعد\s*(?:صلاة\s*)?(الفجر|الظهر|العصر|المغرب|العشاء)/;
const clock = (v: unknown) => (/^\d{1,2}:\d{2}$/.test(str(v).trim()) ? str(v).trim().padStart(5, "0") : null);

export interface Schedule {
  scheduleMode: "CLOCK" | "PRAYER" | null;
  startTime: string | null;
  endTime: string | null;
  startPrayer: string | null;
  endPrayer: string | null;
}

/**
 * Old `halaqa.time` → schedule columns:
 *   { mode: "clock", from, to }                              → CLOCK, startTime, endTime
 *   { mode: "prayer", fromPrayer, toKind: "prayer", toPrayer } → PRAYER, startPrayer, endPrayer
 *   { mode: "prayer", fromPrayer, toKind: "clock", toTime }    → PRAYER, startPrayer, endTime
 * Even older data has a free-text `schedule` («بعد صلاة العصر»), from which the prayer is read.
 */
export function schedule(time: unknown, legacyText: unknown): Schedule {
  const none: Schedule = { scheduleMode: null, startTime: null, endTime: null, startPrayer: null, endPrayer: null };
  const t = obj(time);
  if (t.mode === "clock") {
    const startTime = clock(t.from);
    const endTime = clock(t.to);
    return startTime && endTime ? { ...none, scheduleMode: "CLOCK", startTime, endTime } : none;
  }
  if (t.mode === "prayer" && strOrNull(t.fromPrayer)) {
    const byClock = t.toKind === "clock";
    return {
      ...none,
      scheduleMode: "PRAYER",
      startPrayer: strOrNull(t.fromPrayer),
      endPrayer: byClock ? null : strOrNull(t.toPrayer),
      endTime: byClock ? clock(t.toTime) : null,
    };
  }
  const m = PRAYER_RE.exec(str(legacyText));
  return m ? { ...none, scheduleMode: "PRAYER", startPrayer: m[1] } : none;
}
