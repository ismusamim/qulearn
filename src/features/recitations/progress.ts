import { RECITATION_TYPE_LABELS } from "@/lib/constants";
import { surahByNumber, surahName } from "@/lib/quran";

/** Pure recitation calculations: range validation, memorised-ayat count and the wording of positions. */

export type RecitationType = keyof typeof RECITATION_TYPE_LABELS;

export interface AyahRange {
  surah: number;
  fromAyah: number;
  toAyah: number;
}

export interface RangeError {
  field: "surah" | "fromAyah" | "toAyah";
  message: string;
}

/**
 * A range must stay inside one surah: 1 ≤ from ≤ to ≤ number of ayat.
 * Returns the first problem (with the field to flag), or null when valid.
 */
export function validateAyahRange(range: AyahRange): RangeError | null {
  const surah = Number.isInteger(range.surah) ? surahByNumber(range.surah) : undefined;
  if (!surah) return { field: "surah", message: "اختر السورة" };
  const { fromAyah, toAyah } = range;
  if (!Number.isInteger(fromAyah) || fromAyah < 1) return { field: "fromAyah", message: "تحقق من أرقام الآيات" };
  if (!Number.isInteger(toAyah) || toAyah < fromAyah) return { field: "toAyah", message: "تحقق من أرقام الآيات" };
  if (toAyah > surah.ayat) return { field: "toAyah", message: `سورة ${surah.name} عدد آياتها ${surah.ayat}` };
  return null;
}

export function ayatInRange(range: Pick<AyahRange, "fromAyah" | "toAyah">): number {
  return Math.max(0, range.toAyah - range.fromAyah + 1);
}

/** «آيات مسجّلة حفظًا»: the sum of the HIFZ ranges (review and consolidation do not count). */
export function hifzAyatCount(
  records: ReadonlyArray<{ type: RecitationType; fromAyah: number; toAyah: number }>,
): number {
  return records.reduce((sum, r) => (r.type === "HIFZ" ? sum + ayatInRange(r) : sum), 0);
}

export interface HifzPosition {
  surah: number;
  toAyah: number;
}

/** The most recent HIFZ record of a log already sorted newest first. */
export function findLastHifz<T extends { type: RecitationType }>(sortedNewestFirst: readonly T[]): T | null {
  return sortedNewestFirst.find((r) => r.type === "HIFZ") ?? null;
}

/** «سورة البقرة – آية 20», or «—» when nothing has been memorised yet. */
export function lastHifzText(position: HifzPosition | null | undefined): string {
  return position ? `سورة ${surahName(position.surah)} – آية ${position.toAyah}` : "—";
}

/** «سورة البقرة (1–20)» */
export function positionText(range: AyahRange): string {
  return `سورة ${surahName(range.surah)} (${range.fromAyah}–${range.toAyah})`;
}

/** «حفظ — سورة البقرة (1–20)» */
export function recitationLine(record: AyahRange & { type: RecitationType }): string {
  return `${RECITATION_TYPE_LABELS[record.type]} — ${positionText(record)}`;
}
