import { ageFromBirthDate, type ISODate, todayISO } from "@/lib/dates";
import { surahName } from "@/lib/quran";

/** School grades offered on the application form, from kindergarten to university. */
export const SCHOOL_GRADES = [
  "الروضة 1",
  "الروضة 2",
  "الصف الأول الابتدائي",
  "الصف الثاني الابتدائي",
  "الصف الثالث الابتدائي",
  "الصف الرابع الابتدائي",
  "الصف الخامس الابتدائي",
  "الصف السادس الابتدائي",
  "الصف الأول الإعدادي",
  "الصف الثاني الإعدادي",
  "الصف الثالث الإعدادي",
  "الصف الأول الثانوي",
  "الصف الثاني الثانوي",
  "الصف الثالث الثانوي",
  "الجامعة",
] as const;

/** The grade list, keeping a stored value that is not in the list (imported data) selectable. */
export function gradeOptions(current?: string | null): string[] {
  const list: string[] = [...SCHOOL_GRADES];
  if (current && !list.includes(current)) list.push(current);
  return list;
}

/**
 * The contact number kept on the account (Member.phone): the guardian's for a
 * child (falling back to the student's own), the student's own for an adult.
 * An existing number is kept when the form leaves both empty.
 */
export function primaryPhone(
  category: "CHILD" | "ADULT",
  phones: { phone: string; guardianPhone: string },
  existing = "",
): string {
  return category === "CHILD"
    ? phones.guardianPhone || phones.phone || existing
    : phones.phone || existing;
}

/**
 * Age in whole years. A birth date (typed, or read from the national ID) wins;
 * adults who only gave an age are stored as a birth year.
 */
export function studentAge(
  student: { birthDate: ISODate | null; birthYear: number | null },
  today: ISODate = todayISO(),
): number | null {
  if (student.birthDate) return ageFromBirthDate(student.birthDate, today);
  if (student.birthYear) {
    const age = Number(today.slice(0, 4)) - student.birthYear;
    return age >= 0 ? age : null;
  }
  return null;
}

/** An adult's stated age → the birth year that is stored. */
export function birthYearFromAge(age: number | null, today: ISODate = todayISO()): number | null {
  return age == null ? null : Number(today.slice(0, 4)) - age;
}

/** «سورة البقرة (1–5)» for the last memorised passage. */
export function hifzPositionText(rec: { surah: number; fromAyah: number; toAyah: number } | null | undefined): string {
  if (!rec) return "—";
  return `سورة ${surahName(rec.surah)} (${rec.fromAyah}–${rec.toAyah})`;
}

/** Attendance rate: present and late count as attended; «—» with no records. */
export function attendanceRateText(attended: number, total: number): string {
  return total > 0 ? `${Math.round((attended * 100) / total)}%` : "—";
}

/**
 * Avatars are cropped to 160px on the client; the server refuses anything
 * bigger than ~60KB so a crafted request cannot bloat the members table.
 */
export const PHOTO_SIZE = 160;
export const MAX_PHOTO_BYTES = 60 * 1024;
const PHOTO_PREFIX = /^data:image\/(webp|jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/;

export function photoProblem(dataUrl: string): string | null {
  const match = PHOTO_PREFIX.exec(dataUrl);
  if (!match) return "صيغة الصورة غير مدعومة";
  const bytes = Math.floor((match[2].length * 3) / 4);
  return bytes > MAX_PHOTO_BYTES ? "الصورة أكبر من المسموح" : null;
}

/** «حالات خاصة» style label for a discount in a picker. */
export function discountLabel(d: { name: string; type: "PERCENT" | "AMOUNT"; value: number; perStudent: boolean }): string {
  if (d.perStudent) return `${d.name} — يُحدَّد لكل طالب`;
  return `${d.name} — ${d.value}${d.type === "PERCENT" ? "%" : " جنيه"}`;
}
