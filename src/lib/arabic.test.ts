import { describe, expect, it } from "vitest";

import { fixName, normalizeArabic, normalizePhone } from "./arabic";

describe("normalizeArabic", () => {
  it("unifies hamza, taa marbuta, alef maqsura and diacritics", () => {
    expect(normalizeArabic("أَحْمَد")).toBe("احمد");
    expect(normalizeArabic("فاطمة")).toBe("فاطمه");
    expect(normalizeArabic("مصطفى")).toBe("مصطفي");
  });
  it("treats «عبد الله» and «عبدالله» alike", () => {
    expect(normalizeArabic("عبد  الله محمد")).toBe(normalizeArabic("عبدالله محمد"));
  });
});

describe("fixName", () => {
  it("splits عبد from the following name but leaves عبده", () => {
    expect(fixName("عبدالله  عبدالرحمن")).toBe("عبد الله عبد الرحمن");
    expect(fixName("عبدربه")).toBe("عبد ربه");
    expect(fixName("عبده")).toBe("عبده");
  });
});

describe("normalizePhone", () => {
  it("keeps digits, converts Arabic digits and restores the leading zero", () => {
    expect(normalizePhone("٠١٠-1234 5678")).toBe("01012345678");
    expect(normalizePhone("1012345678")).toBe("01012345678");
  });
});
