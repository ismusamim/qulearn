import { toLatinDigits } from "@/lib/arabic";
import { ageFromBirthDate, type ISODate, todayISO } from "@/lib/dates";

/** Governorate codes that may appear in digits 8–9 of an Egyptian national ID. */
const GOVERNORATES = new Set([
  "01", "02", "03", "04", "11", "12", "13", "14", "15", "16", "17", "18", "19",
  "21", "22", "23", "24", "25", "26", "27", "28", "29", "31", "32", "33", "34", "35", "88",
]);

export type NationalIdResult =
  | { status: "empty" }
  | { status: "invalid"; error: string; /** Still being typed (fewer than 14 digits). */ partial: boolean }
  | { status: "valid"; nationalId: string; birthDate: ISODate; age: number; male: boolean };

/**
 * Validates a 14-digit Egyptian national ID and extracts the birth date, age
 * and gender encoded in it.
 */
export function parseNationalId(raw: string | null | undefined, today: ISODate = todayISO()): NationalIdResult {
  const n = toLatinDigits(raw).replace(/\D/g, "");
  if (!n) return { status: "empty" };
  if (n.length !== 14) {
    return { status: "invalid", error: `الرقم القومي 14 رقمًا (كتبت ${n.length})`, partial: n.length < 14 };
  }
  const century = { "2": 1900, "3": 2000 }[n[0]];
  if (!century) return { status: "invalid", error: "الرقم القومي يبدأ بـ 2 أو 3", partial: false };

  const y = century + Number(n.slice(1, 3));
  const m = Number(n.slice(3, 5));
  const d = Number(n.slice(5, 7));
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return { status: "invalid", error: "تاريخ الميلاد في الرقم القومي غير صحيح", partial: false };
  }
  const birthDate = date.toISOString().slice(0, 10);
  if (birthDate > today) {
    return { status: "invalid", error: "تاريخ الميلاد في الرقم القومي بعد اليوم", partial: false };
  }
  if (!GOVERNORATES.has(n.slice(7, 9))) {
    return { status: "invalid", error: "كود المحافظة في الرقم القومي غير صحيح", partial: false };
  }
  return {
    status: "valid",
    nationalId: n,
    birthDate,
    age: ageFromBirthDate(birthDate, today) ?? 0,
    male: Number(n[12]) % 2 === 1,
  };
}
