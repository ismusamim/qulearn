import { describe, expect, it } from "vitest";

import {
  ayatInRange,
  findLastHifz,
  hifzAyatCount,
  lastHifzText,
  positionText,
  recitationLine,
  validateAyahRange,
} from "./progress";

describe("validateAyahRange", () => {
  it("accepts a range inside the surah, including its last ayah", () => {
    expect(validateAyahRange({ surah: 1, fromAyah: 1, toAyah: 7 })).toBeNull();
    expect(validateAyahRange({ surah: 2, fromAyah: 286, toAyah: 286 })).toBeNull();
  });
  it("rejects an unknown surah", () => {
    expect(validateAyahRange({ surah: 0, fromAyah: 1, toAyah: 1 })?.field).toBe("surah");
    expect(validateAyahRange({ surah: 115, fromAyah: 1, toAyah: 1 })?.field).toBe("surah");
    expect(validateAyahRange({ surah: 1.5, fromAyah: 1, toAyah: 1 })?.field).toBe("surah");
  });
  it("rejects a start below 1 or a non-integer", () => {
    expect(validateAyahRange({ surah: 1, fromAyah: 0, toAyah: 3 })).toEqual({ field: "fromAyah", message: "تحقق من أرقام الآيات" });
    expect(validateAyahRange({ surah: 1, fromAyah: Number.NaN, toAyah: 3 })?.field).toBe("fromAyah");
  });
  it("rejects an end before the start", () => {
    expect(validateAyahRange({ surah: 2, fromAyah: 10, toAyah: 9 })).toEqual({ field: "toAyah", message: "تحقق من أرقام الآيات" });
  });
  it("rejects an end past the surah's length, naming the surah", () => {
    expect(validateAyahRange({ surah: 1, fromAyah: 1, toAyah: 8 })).toEqual({ field: "toAyah", message: "سورة الفاتحة عدد آياتها 7" });
    expect(validateAyahRange({ surah: 114, fromAyah: 7, toAyah: 7 })?.message).toBe("سورة الناس عدد آياتها 6");
  });
});

describe("hifzAyatCount", () => {
  it("sums only the HIFZ ranges, inclusive of both ends", () => {
    expect(ayatInRange({ fromAyah: 5, toAyah: 5 })).toBe(1);
    expect(
      hifzAyatCount([
        { type: "HIFZ", fromAyah: 1, toAyah: 7 },
        { type: "REVIEW", fromAyah: 1, toAyah: 100 },
        { type: "HIFZ", fromAyah: 10, toAyah: 12 },
        { type: "CONSOLIDATION", fromAyah: 1, toAyah: 5 },
      ]),
    ).toBe(10);
    expect(hifzAyatCount([])).toBe(0);
  });
});

describe("last memorised position", () => {
  it("picks the newest HIFZ record of a sorted log", () => {
    const log = [
      { type: "REVIEW" as const, surah: 1, toAyah: 7 },
      { type: "HIFZ" as const, surah: 2, toAyah: 20 },
      { type: "HIFZ" as const, surah: 2, toAyah: 10 },
    ];
    expect(findLastHifz(log)).toEqual({ type: "HIFZ", surah: 2, toAyah: 20 });
    expect(findLastHifz([log[0]])).toBeNull();
  });
  it("formats the position, or a dash when there is none", () => {
    expect(lastHifzText({ surah: 2, toAyah: 20 })).toBe("سورة البقرة – آية 20");
    expect(lastHifzText(null)).toBe("—");
  });
});

describe("wording", () => {
  it("describes a record", () => {
    expect(positionText({ surah: 36, fromAyah: 1, toAyah: 12 })).toBe("سورة يس (1–12)");
    expect(recitationLine({ type: "CONSOLIDATION", surah: 112, fromAyah: 1, toAyah: 4 })).toBe("تثبيت — سورة الإخلاص (1–4)");
  });
});
