/**
 * Date-only values travel between client and server as ISO strings ("YYYY-MM-DD")
 * and are stored in Postgres DATE columns as UTC midnight.
 */

export type ISODate = string;

const pad = (n: number) => String(n).padStart(2, "0");

export const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
] as const;

export const WEEKDAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"] as const;

/**
 * The organisation's timezone. "Today" must mean the same day on the server
 * (often UTC) and in every browser, so it is never taken from the local clock.
 */
export const APP_TIME_ZONE = "Africa/Cairo";

const isoDateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's date in the organisation's timezone. */
export function todayISO(now: Date = new Date()): ISODate {
  return isoDateFormat.format(now);
}

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** ISO date string → Date at UTC midnight (what Prisma expects for @db.Date). */
export function fromISODate(value: ISODate): Date {
  return new Date(value + "T00:00:00Z");
}

/** Date from a @db.Date column → ISO date string. */
export function toISODate(value: Date): ISODate;
export function toISODate(value: Date | null | undefined): ISODate | null;
export function toISODate(value: Date | null | undefined): ISODate | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function monthName(month: number): string {
  return MONTHS_AR[month - 1] ?? "";
}

export function weekdayName(date: ISODate): string {
  return isISODate(date) ? WEEKDAYS_AR[fromISODate(date).getUTCDay()] : "";
}

/** "14:30" → "2:30 م" */
export function formatTime12(time: string | null | undefined): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h)) return "";
  return `${((h + 11) % 12) + 1}:${pad(m || 0)} ${h >= 12 ? "م" : "ص"}`;
}

/** Whole years between a birth date and today; null when unknown or in the future. */
export function ageFromBirthDate(birth: ISODate | null | undefined, today: ISODate = todayISO()): number | null {
  if (!birth || !isISODate(birth)) return null;
  const [by, bm, bd] = birth.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age--;
  return age >= 0 ? age : null;
}
