import { describe, expect, it } from "vitest";

import { myPersonalSchema, myTechnicalSchema, teacherFormSchema, updateTeacherSchema } from "./schemas";

const personal = { fullName: "", birthDate: "", phone: "", email: "", address: "", emergencyContact: "" };
const technical = {
  qualification: "",
  riwaya: "",
  ijaza: "",
  sanad: "",
  memorizedParts: "",
  experienceYears: "",
  specialty: "",
  courses: "",
};
const administrative = { employeeNo: "", joinDate: "", contractType: "", status: "ACTIVE", monthlyPay: "", adminNote: "" };

describe("myTechnicalSchema", () => {
  it("turns empty numbers into null and parses Arabic digits", () => {
    const out = myTechnicalSchema.parse({ ...technical, memorizedParts: " ٣٠ ", experienceYears: "" });
    expect(out.memorizedParts).toBe(30);
    expect(out.experienceYears).toBeNull();
  });

  it.each(["31", "-1", "2.5", "abc"])("rejects memorized parts %s", (value) => {
    const result = myTechnicalSchema.safeParse({ ...technical, memorizedParts: value });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe("الأجزاء المحفوظة من 0 إلى 30");
  });

  it("is idempotent: its own output validates again (form → server action)", () => {
    const once = myTechnicalSchema.parse({ ...technical, memorizedParts: "12", experienceYears: "4" });
    expect(myTechnicalSchema.parse(once)).toEqual(once);
  });
});

describe("myPersonalSchema", () => {
  it("accepts an empty file", () => {
    expect(myPersonalSchema.safeParse(personal).success).toBe(true);
  });

  it("validates email and birth date", () => {
    expect(myPersonalSchema.safeParse({ ...personal, email: "not-an-email" }).success).toBe(false);
    expect(myPersonalSchema.safeParse({ ...personal, email: "a@b.co" }).success).toBe(true);
    expect(myPersonalSchema.safeParse({ ...personal, birthDate: "1990-02-30" }).success).toBe(false);
    expect(myPersonalSchema.safeParse({ ...personal, birthDate: "1990-02-28" }).success).toBe(true);
  });

  it("drops administrative fields a teacher might send", () => {
    const out = myPersonalSchema.parse({ ...personal, status: "ACTIVE", monthlyPay: "9999", id: "x" });
    expect(Object.keys(out).sort()).toEqual(Object.keys(personal).sort());
  });
});

describe("teacherFormSchema", () => {
  const base = { name: " الشيخ أحمد ", ...personal, ...administrative, ...technical };

  it("requires a name and a known status", () => {
    expect(teacherFormSchema.parse(base).name).toBe("الشيخ أحمد");
    expect(teacherFormSchema.safeParse({ ...base, name: "  " }).success).toBe(false);
    expect(teacherFormSchema.safeParse({ ...base, status: "FIRED" }).success).toBe(false);
  });

  it("parses the monthly pay and refuses negatives", () => {
    expect(teacherFormSchema.parse({ ...base, monthlyPay: "1500.5" }).monthlyPay).toBe(1500.5);
    expect(teacherFormSchema.safeParse({ ...base, monthlyPay: "-5" }).success).toBe(false);
  });

  it("update schema needs a uuid and defaults extra", () => {
    expect(updateTeacherSchema.safeParse({ ...base, id: "nope" }).success).toBe(false);
    const out = updateTeacherSchema.parse({ ...base, id: "3f2b8c1e-6a4d-4c9b-8f1a-2d3e4f5a6b7c" });
    expect(out.extra).toEqual({});
  });
});
