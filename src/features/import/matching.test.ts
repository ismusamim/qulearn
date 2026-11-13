import { describe, expect, it } from "vitest";

import { normalizeArabic } from "@/lib/arabic";

import { applyField, emptyPatch, parseLooseDate } from "./apply-field";
import { fieldTargets, headerKey, matchHeader } from "./fields";
import { analyzeTable, buildImportTable, duplicateTargets, halaqaQueryKeys, MAP_PENDING, MAP_SKIP } from "./matching";

const students = fieldTargets("STUDENTS", [{ key: "f_blood", label: "فصيلة الدم" }]);
const teachers = fieldTargets("TEACHERS", []);

describe("header matching", () => {
  it("ignores spaces, punctuation, hamza forms and case", () => {
    expect(headerKey(" رقم_الجوال: ")).toBe(headerKey("رقم الجوال"));
    expect(matchHeader("الهاتف", students)?.id).toBe("core:phone");
    expect(matchHeader("Password", students)?.id).toBe("core:pin");
    expect(matchHeader("المعلم", students)?.id).toBe("core:halaqa");
    expect(matchHeader("ولي الامر", students)?.id).toBe("info:gName");
    expect(matchHeader("فصيلة الدم", students)?.id).toBe("extra:f_blood");
    expect(matchHeader("لون العين", students)).toBeUndefined();
  });

  it("matches teacher file columns by label, bare label and synonyms", () => {
    expect(matchHeader("الأجزاء المحفوظة", teachers)?.id).toBe("prof:tech:memorized");
    expect(matchHeader("الخبرة", teachers)?.id).toBe("prof:tech:exp");
    expect(matchHeader("Email", teachers)?.id).toBe("prof:personal:email");
    expect(matchHeader("الحلقة", teachers)).toBeUndefined();
  });
});

describe("analyzeTable", () => {
  const table = [
    ["كشف الطلاب", "", "", "", ""],
    ["الاسم", "الحلقة", "الجوال", "لون العين", "هاتف"],
    [" محمد   أحمد ", "حلقة الفرقان", "١٠١٢٣٤٥٦٧٨", "بني", ""],
    ["", "x", "", "", ""],
    ["علي", "", "", "", ""],
  ];

  it("finds the header row within the first rows and classifies columns", () => {
    const result = analyzeTable(table, students);
    if (!result.ok) throw new Error(result.error);
    expect(result.analysis.nameColumn).toBe(0);
    expect(result.analysis.columns).toEqual([
      { index: 1, header: "الحلقة", target: "core:halaqa" },
      { index: 2, header: "الجوال", target: "core:phone" },
      { index: 3, header: "لون العين", target: MAP_PENDING },
      // A second phone column is not imported twice.
      { index: 4, header: "هاتف", target: MAP_SKIP },
    ]);
    expect(result.analysis.rows).toHaveLength(2);
  });

  it("builds rows: skipped columns dropped, digits converted, names tidied", () => {
    const result = analyzeTable(table, students);
    if (!result.ok) throw new Error(result.error);
    const built = buildImportTable(result.analysis, result.analysis.columns);
    expect(built.columns).toEqual([
      { header: "الحلقة", target: "core:halaqa" },
      { header: "الجوال", target: "core:phone" },
      { header: "لون العين", target: null },
    ]);
    expect(built.rows[0]).toEqual({ name: "محمد أحمد", values: ["حلقة الفرقان", "1012345678", "بني"] });
  });

  it("reports a missing name column and an empty body", () => {
    expect(analyzeTable([["a", "b"], ["1", "2"]], students)).toMatchObject({ ok: false });
    expect(analyzeTable([["الاسم"]], students)).toMatchObject({ ok: false, error: "لا توجد صفوف بيانات بعد صف العناوين." });
  });

  it("detects a target chosen for two columns", () => {
    expect(
      duplicateTargets([
        { index: 1, header: "a", target: "core:phone" },
        { index: 2, header: "b", target: "core:phone" },
        { index: 3, header: "c", target: MAP_PENDING },
        { index: 4, header: "d", target: MAP_PENDING },
      ]),
    ).toEqual(["core:phone"]);
  });

  it("reads a halaqa cell with or without the word «حلقة»", () => {
    expect(halaqaQueryKeys("حلقة الشيخ أحمد", normalizeArabic)).toEqual(["حلقه الشيخ احمد", "الشيخ احمد"]);
  });
});

describe("applyField", () => {
  it("routes values to the right table and converts types", () => {
    const p = emptyPatch();
    expect(applyField(p, "core:phone", "1012345678")).toBe(true);
    expect(applyField(p, "info:birth", "5/3/2012")).toBe(true);
    expect(applyField(p, "info:whatsapp", "010-1234 5678")).toBe(true);
    expect(applyField(p, "info:gName", "أحمد")).toBe(true);
    expect(applyField(p, "prof:admin:status", "موقوف")).toBe(true);
    expect(applyField(p, "prof:admin:pay", "1,500.5")).toBe(true);
    expect(applyField(p, "prof:tech:memorized", "30")).toBe(true);
    expect(applyField(p, "extra:f_blood", "O+")).toBe(true);
    expect(p).toEqual({
      phone: "01012345678",
      extra: { f_blood: "O+" },
      student: { birthDate: "2012-03-05", whatsapp: "01012345678", guardianName: "أحمد" },
      teacher: { status: "SUSPENDED", monthlyPay: 1500.5, memorizedParts: 30 },
    });
  });

  it("rejects values that do not fit the column and ignores blanks", () => {
    const p = emptyPatch();
    expect(applyField(p, "info:birth", "غير معروف")).toBe(false);
    expect(applyField(p, "prof:tech:exp", "كثير")).toBe(false);
    expect(applyField(p, "info:nope", "x")).toBe(false);
    expect(applyField(p, "info:address", "   ")).toBe(true);
    expect(p).toEqual(emptyPatch());
  });

  it("parses the date spellings found in sheets", () => {
    expect(parseLooseDate("2012-3-5")).toBe("2012-03-05");
    expect(parseLooseDate("٢٥/١٢/٢٠١٠")).toBe("2010-12-25");
    expect(parseLooseDate("44197")).toBe("2021-01-01"); // Excel serial
    expect(parseLooseDate("31/02/2010")).toBeNull();
    expect(parseLooseDate("2012")).toBeNull();
  });
});
