import { describe, expect, it } from "vitest";

import {
  attendanceRateText,
  birthYearFromAge,
  discountLabel,
  gradeOptions,
  hifzPositionText,
  MAX_PHOTO_BYTES,
  photoProblem,
  primaryPhone,
  SCHOOL_GRADES,
  studentAge,
} from "./student-rules";
import { studentFormSchema } from "./schemas";

describe("gradeOptions", () => {
  it("returns the fixed list", () => {
    expect(gradeOptions()).toEqual([...SCHOOL_GRADES]);
    expect(gradeOptions("الجامعة")).toHaveLength(SCHOOL_GRADES.length);
  });
  it("keeps an unknown stored grade selectable", () => {
    expect(gradeOptions("دبلوم").at(-1)).toBe("دبلوم");
  });
});

describe("primaryPhone", () => {
  it("uses the guardian's number for a child, then the student's, then the existing one", () => {
    expect(primaryPhone("CHILD", { phone: "011", guardianPhone: "010" }, "012")).toBe("010");
    expect(primaryPhone("CHILD", { phone: "011", guardianPhone: "" }, "012")).toBe("011");
    expect(primaryPhone("CHILD", { phone: "", guardianPhone: "" }, "012")).toBe("012");
  });
  it("uses the adult's own number and ignores a guardian's", () => {
    expect(primaryPhone("ADULT", { phone: "011", guardianPhone: "010" })).toBe("011");
    expect(primaryPhone("ADULT", { phone: "", guardianPhone: "010" }, "012")).toBe("012");
    expect(primaryPhone("ADULT", { phone: "", guardianPhone: "010" })).toBe("");
  });
});

describe("studentAge", () => {
  it("prefers the birth date", () => {
    expect(studentAge({ birthDate: "2015-06-10", birthYear: 1990 }, "2025-06-09")).toBe(9);
    expect(studentAge({ birthDate: "2015-06-10", birthYear: null }, "2025-06-10")).toBe(10);
  });
  it("falls back to the birth year", () => {
    expect(studentAge({ birthDate: null, birthYear: 1990 }, "2025-01-01")).toBe(35);
    expect(studentAge({ birthDate: null, birthYear: null })).toBeNull();
  });
  it("round-trips an adult's stated age", () => {
    const year = birthYearFromAge(40, "2025-03-01");
    expect(year).toBe(1985);
    expect(studentAge({ birthDate: null, birthYear: year }, "2025-03-01")).toBe(40);
    expect(birthYearFromAge(null)).toBeNull();
  });
});

describe("list texts", () => {
  it("describes the last memorised passage", () => {
    expect(hifzPositionText({ surah: 2, fromAyah: 1, toAyah: 5 })).toBe("سورة البقرة (1–5)");
    expect(hifzPositionText(null)).toBe("—");
  });
  it("computes the attendance rate", () => {
    expect(attendanceRateText(3, 4)).toBe("75%");
    expect(attendanceRateText(0, 0)).toBe("—");
  });
  it("labels discounts", () => {
    expect(discountLabel({ name: "أيتام", type: "PERCENT", value: 100, perStudent: false })).toBe("أيتام — 100%");
    expect(discountLabel({ name: "إخوة", type: "AMOUNT", value: 20, perStudent: false })).toBe("إخوة — 20 جنيه");
    expect(discountLabel({ name: "حالات خاصة", type: "PERCENT", value: 0, perStudent: true })).toContain("لكل طالب");
  });
});

describe("photoProblem", () => {
  it("accepts a small image data URL", () => {
    expect(photoProblem("data:image/webp;base64,AAAA")).toBeNull();
  });
  it("rejects other content and oversized images", () => {
    expect(photoProblem("https://example.com/a.png")).not.toBeNull();
    expect(photoProblem("data:text/html;base64,AAAA")).not.toBeNull();
    const big = "A".repeat(Math.ceil((MAX_PHOTO_BYTES * 4) / 3) + 8);
    expect(photoProblem(`data:image/jpeg;base64,${big}`)).not.toBeNull();
  });
});

describe("studentFormSchema", () => {
  const base = {
    category: "CHILD",
    name: "  أحمد   محمد ",
    nationalId: "",
    birthDate: "",
    age: "",
    address: "",
    phone: "١٠٠١٢٣٤٥٦٧",
    whatsapp: "",
    study: "",
    grade: "",
    guardianName: "",
    guardianJob: "",
    guardianPhone: "",
    guardianWhatsapp: "",
    guardianRelation: "",
    guardianRelationOther: "",
    maritalStatus: "",
    qualification: "",
    qualificationStatus: "",
    job: "",
    availability: "",
    testReading: "",
    testTajweed: "",
    testHifz: "",
    halaqaId: "",
    joinDate: "",
    monthlyFee: "",
    pledgeSigned: false,
    photo: null,
    extra: {},
  };

  it("normalises phones and empty values", () => {
    const out = studentFormSchema.parse(base);
    expect(out.phone).toBe("01001234567");
    expect(out.halaqaId).toBeNull();
    expect(out.birthDate).toBeNull();
    expect(out.monthlyFee).toBeNull();
    expect(out.age).toBeNull();
  });
  it("rejects a malformed national ID and an out-of-range age", () => {
    expect(studentFormSchema.safeParse({ ...base, nationalId: "123" }).success).toBe(false);
    expect(studentFormSchema.safeParse({ ...base, category: "ADULT", age: "3" }).success).toBe(false);
    expect(studentFormSchema.parse({ ...base, category: "ADULT", age: "30" }).age).toBe(30);
  });
  it("requires a name", () => {
    expect(studentFormSchema.safeParse({ ...base, name: "   " }).success).toBe(false);
  });
});
