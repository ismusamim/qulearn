import { describe, expect, it } from "vitest";

import { JUZ_STARTS, TOTAL_AYAT, ayahIndex, fromAyahIndex, isJuz, juzOf, juzRange, juzSpanRange, passageInRange } from "./juz";

describe("global ayah index", () => {
  it("counts 6236 ayat", () => {
    expect(TOTAL_AYAT).toBe(6236);
  });

  it("maps surah/ayah to a 0-based index", () => {
    expect(ayahIndex(1, 1)).toBe(0);
    expect(ayahIndex(1, 7)).toBe(6);
    expect(ayahIndex(2, 1)).toBe(7);
    expect(ayahIndex(114, 6)).toBe(TOTAL_AYAT - 1);
  });

  it("round-trips at surah boundaries", () => {
    expect(fromAyahIndex(0)).toEqual({ surah: 1, ayah: 1 });
    expect(fromAyahIndex(6)).toEqual({ surah: 1, ayah: 7 });
    expect(fromAyahIndex(7)).toEqual({ surah: 2, ayah: 1 });
    expect(fromAyahIndex(TOTAL_AYAT - 1)).toEqual({ surah: 114, ayah: 6 });
    for (const index of [0, 148, 292, 1234, 3000, 5671, 6235]) {
      const { surah, ayah } = fromAyahIndex(index);
      expect(ayahIndex(surah, ayah)).toBe(index);
    }
  });
});

describe("juzRange", () => {
  it("has 30 ajza covering the whole Quran without gaps or overlaps", () => {
    expect(JUZ_STARTS).toHaveLength(30);
    expect(juzRange(1)[0]).toBe(0);
    expect(juzRange(30)[1]).toBe(TOTAL_AYAT - 1);
    for (let j = 1; j < 30; j++) expect(juzRange(j + 1)[0]).toBe(juzRange(j)[1] + 1);
  });

  it("knows the first and last juz", () => {
    expect(juzRange(1)).toEqual([ayahIndex(1, 1), ayahIndex(2, 141)]);
    expect(juzRange(30)).toEqual([ayahIndex(78, 1), ayahIndex(114, 6)]);
    // Juz 30 has 564 ayat.
    expect(juzRange(30)[1] - juzRange(30)[0] + 1).toBe(564);
  });

  it("spans several ajza for a competition level", () => {
    expect(juzSpanRange(29, 30)).toEqual([ayahIndex(67, 1), TOTAL_AYAT - 1]);
    expect(juzSpanRange(5, 5)).toEqual(juzRange(5));
  });

  it("finds the juz of an ayah", () => {
    expect(juzOf(1, 1)).toBe(1);
    expect(juzOf(2, 141)).toBe(1);
    expect(juzOf(2, 142)).toBe(2);
    expect(juzOf(18, 74)).toBe(15);
    expect(juzOf(18, 75)).toBe(16);
    expect(juzOf(114, 6)).toBe(30);
  });

  it("checks that a passage lies inside a range", () => {
    const juz2 = juzRange(2);
    expect(passageInRange(2, 142, 146, juz2)).toBe(true);
    expect(passageInRange(2, 140, 143, juz2)).toBe(false);
    expect(passageInRange(2, 250, 254, juz2)).toBe(false);
    expect(passageInRange(2, 252, 252, juz2)).toBe(true);
    expect(passageInRange(77, 48, 50, juzRange(30))).toBe(false);
  });

  it("validates juz numbers", () => {
    expect(isJuz(1)).toBe(true);
    expect(isJuz(30)).toBe(true);
    expect(isJuz(0)).toBe(false);
    expect(isJuz(31)).toBe(false);
    expect(isJuz(2.5)).toBe(false);
    expect(isJuz(null)).toBe(false);
  });
});
