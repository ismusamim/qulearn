import { SURAHS } from "@/lib/quran";

/**
 * Juz boundaries and a "global ayah index" (0-based position of an ayah in the
 * whole mushaf), used to tell whether a question lies inside a juz and to pick
 * random positions inside a range.
 */

/** Where each of the 30 ajza starts: [surah, ayah]. */
export const JUZ_STARTS: ReadonlyArray<readonly [surah: number, ayah: number]> = [
  [1, 1], [2, 142], [2, 253], [3, 93], [4, 24], [4, 148], [5, 82], [6, 111], [7, 88], [8, 41],
  [9, 93], [11, 6], [12, 53], [15, 1], [17, 1], [18, 75], [21, 1], [23, 1], [25, 21], [27, 56],
  [29, 46], [33, 31], [36, 28], [39, 32], [41, 47], [46, 1], [51, 31], [58, 1], [67, 1], [78, 1],
];

export const JUZ_COUNT = 30;

/** Global index of the first ayah of each surah. */
const SURAH_START: number[] = [];
let running = 0;
for (const surah of SURAHS) {
  SURAH_START.push(running);
  running += surah.ayat;
}

/** 6236 */
export const TOTAL_AYAT = running;

/** Inclusive range of global ayah indexes. */
export type AyahRange = readonly [from: number, to: number];

export interface AyahPosition {
  surah: number;
  ayah: number;
}

/** (surah 1–114, ayah 1–n) → 0-based index in the whole Quran. */
export function ayahIndex(surah: number, ayah: number): number {
  return SURAH_START[surah - 1] + ayah - 1;
}

/** Inverse of ayahIndex. */
export function fromAyahIndex(index: number): AyahPosition {
  let s = 0;
  while (s < SURAHS.length - 1 && SURAH_START[s + 1] <= index) s++;
  return { surah: s + 1, ayah: index - SURAH_START[s] + 1 };
}

export function isJuz(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= JUZ_COUNT;
}

/** First and last global ayah index of a juz (1–30). */
export function juzRange(juz: number): AyahRange {
  const [surah, ayah] = JUZ_STARTS[juz - 1];
  const next = JUZ_STARTS[juz];
  return [ayahIndex(surah, ayah), next ? ayahIndex(next[0], next[1]) - 1 : TOTAL_AYAT - 1];
}

/** Range covered by consecutive ajza `fromJuz`…`toJuz` (a competition level). */
export function juzSpanRange(fromJuz: number, toJuz: number): AyahRange {
  return [juzRange(fromJuz)[0], juzRange(toJuz)[1]];
}

/** The juz (1–30) containing an ayah. */
export function juzOf(surah: number, ayah: number): number {
  const index = ayahIndex(surah, ayah);
  let juz = 1;
  while (juz < JUZ_COUNT && juzRange(juz + 1)[0] <= index) juz++;
  return juz;
}

/** Is the passage surah:fromAyah–toAyah entirely inside the range? */
export function passageInRange(surah: number, fromAyah: number, toAyah: number, range: AyahRange): boolean {
  return ayahIndex(surah, fromAyah) >= range[0] && ayahIndex(surah, toAyah) <= range[1];
}
