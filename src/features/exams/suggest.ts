import { surahByNumber } from "@/lib/quran";

import { type AyahRange, ayahIndex, fromAyahIndex, juzRange, juzSpanRange } from "./juz";
import type { ExamType, LevelRange } from "./rules";

/** A suggested question covers this many ayat (fewer at the end of a surah or range). */
export const SUGGESTION_SPAN = 5;

export interface SuggestedPosition {
  surah: number;
  fromAyah: number;
  toAyah: number;
}

/**
 * A random passage starting anywhere in the given ranges (uniform over ayat).
 * With `clip`, the passage also ends inside the range it starts in, so that it
 * passes the juz check of mastery and competition exams.
 */
export function randomPosition(
  ranges: readonly AyahRange[],
  rng: () => number = Math.random,
  clip = false,
): SuggestedPosition | null {
  const valid = ranges.filter(([lo, hi]) => hi >= lo);
  const total = valid.reduce((sum, [lo, hi]) => sum + (hi - lo + 1), 0);
  if (!total) return null;
  let k = Math.min(total - 1, Math.floor(rng() * total));
  for (const [lo, hi] of valid) {
    const size = hi - lo + 1;
    if (k < size) {
      const { surah, ayah } = fromAyahIndex(lo + k);
      let toAyah = Math.min(ayah + SUGGESTION_SPAN - 1, surahByNumber(surah).ayat);
      if (clip) toAyah = Math.min(toAyah, ayah + (hi - (lo + k)));
      return { surah, fromAyah: ayah, toAyah };
    }
    k -= size;
  }
  return null;
}

/** A memorised passage (حفظ) as a range; tolerant of reversed bounds. */
export function recitationRange(r: { surah: number; fromAyah: number; toAyah: number }): AyahRange {
  const a = ayahIndex(r.surah, r.fromAyah);
  const b = ayahIndex(r.surah, r.toAyah);
  return [Math.min(a, b), Math.max(a, b)];
}

export interface SuggestInput {
  type: ExamType;
  count: number;
  /** What the student memorised, newest first. */
  hifzRanges: readonly AyahRange[];
  juz?: number | null;
  level?: LevelRange | null;
}

/**
 * Random question positions from the right range for each exam type:
 *  - periodic: the first in the latest memorised portion, the rest in older ones
 *  - mastery: inside the chosen juz
 *  - competition: inside the level's ajza
 *  - follow-up: anywhere in what the student memorised
 * A student with no memorisation records is asked from juz 30.
 */
export function suggestPositions(input: SuggestInput, rng: () => number = Math.random): Array<SuggestedPosition | null> {
  const { type, count, hifzRanges } = input;
  const fallback = [juzRange(30)];
  const repeat = (ranges: readonly AyahRange[], clip = false) => Array.from({ length: count }, () => randomPosition(ranges, rng, clip));

  if (type === "MASTERY") return repeat([juzRange(input.juz || 30)], true);
  if (type === "COMPETITION") {
    const level = input.level ?? { fromJuz: 30, toJuz: 30 };
    return repeat([juzSpanRange(level.fromJuz, level.toJuz)], true);
  }
  if (type === "PERIODIC") {
    const [latest, ...older] = hifzRanges;
    const newPortion = latest ? [latest] : fallback;
    const revision = older.length ? older : newPortion;
    return Array.from({ length: count }, (_, i) => randomPosition(i === 0 ? newPortion : revision, rng));
  }
  return repeat(hifzRanges.length ? hifzRanges : fallback);
}
