import { describe, expect, it } from "vitest";

import { ayahIndex, juzRange, juzSpanRange, passageInRange } from "./juz";
import { randomPosition, recitationRange, suggestPositions } from "./suggest";

/** Deterministic "random" numbers cycling through the given values. */
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe("randomPosition", () => {
  it("returns null without ranges", () => {
    expect(randomPosition([])).toBeNull();
  });

  it("picks a five-ayah passage, cut at the end of the surah", () => {
    const fatiha: [number, number] = [ayahIndex(1, 1), ayahIndex(1, 7)];
    expect(randomPosition([fatiha], () => 0)).toEqual({ surah: 1, fromAyah: 1, toAyah: 5 });
    expect(randomPosition([fatiha], () => 0.999)).toEqual({ surah: 1, fromAyah: 7, toAyah: 7 });
  });

  it("spreads over several ranges", () => {
    const ranges: Array<[number, number]> = [
      [ayahIndex(112, 1), ayahIndex(112, 4)],
      [ayahIndex(114, 1), ayahIndex(114, 6)],
    ];
    expect(randomPosition(ranges, () => 0.5)).toEqual({ surah: 114, fromAyah: 2, toAyah: 6 });
  });

  it("clips the passage to its range when asked", () => {
    const range: [number, number] = [ayahIndex(2, 130), ayahIndex(2, 141)];
    expect(randomPosition([range], () => 0.999)).toEqual({ surah: 2, fromAyah: 141, toAyah: 145 });
    expect(randomPosition([range], () => 0.999, true)).toEqual({ surah: 2, fromAyah: 141, toAyah: 141 });
  });
});

describe("suggestPositions", () => {
  it("keeps mastery questions inside the juz", () => {
    for (const juz of [1, 2, 15, 30]) {
      const out = suggestPositions({ type: "MASTERY", count: 4, hifzRanges: [], juz }, seq(0, 0.25, 0.75, 0.9999));
      expect(out).toHaveLength(4);
      for (const p of out) expect(p && passageInRange(p.surah, p.fromAyah, p.toAyah, juzRange(juz))).toBe(true);
    }
  });

  it("keeps competition questions inside the level", () => {
    const level = { fromJuz: 28, toJuz: 29, questionCount: 5 };
    const out = suggestPositions({ type: "COMPETITION", count: 5, hifzRanges: [], level }, seq(0, 0.3, 0.5, 0.8, 0.9999));
    for (const p of out) expect(p && passageInRange(p.surah, p.fromAyah, p.toAyah, juzSpanRange(28, 29))).toBe(true);
  });

  it("asks periodic exams from the latest portion first, then from older ones", () => {
    const latest = recitationRange({ surah: 78, fromAyah: 1, toAyah: 10 });
    const older = recitationRange({ surah: 80, fromAyah: 1, toAyah: 10 });
    const [first, second, third] = suggestPositions({ type: "PERIODIC", count: 3, hifzRanges: [latest, older] }, () => 0);
    expect(first).toEqual({ surah: 78, fromAyah: 1, toAyah: 5 });
    expect(second).toEqual({ surah: 80, fromAyah: 1, toAyah: 5 });
    expect(third).toEqual({ surah: 80, fromAyah: 1, toAyah: 5 });
  });

  it("falls back to the latest portion, then to juz 30", () => {
    const latest = recitationRange({ surah: 78, fromAyah: 1, toAyah: 10 });
    expect(suggestPositions({ type: "PERIODIC", count: 2, hifzRanges: [latest] }, () => 0)[1]).toEqual({ surah: 78, fromAyah: 1, toAyah: 5 });
    expect(suggestPositions({ type: "FOLLOW_UP", count: 2, hifzRanges: [] }, () => 0)).toEqual([
      { surah: 78, fromAyah: 1, toAyah: 5 },
      { surah: 78, fromAyah: 1, toAyah: 5 },
    ]);
  });

  it("tolerates reversed recitation bounds", () => {
    expect(recitationRange({ surah: 1, fromAyah: 7, toAyah: 1 })).toEqual([0, 6]);
  });
});
