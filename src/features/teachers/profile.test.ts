import { describe, expect, it } from "vitest";

import { PROFILE_SECTIONS, filterTeachers, mergeExtra, readExtra } from "./profile";
import { myPersonalSchema, myTechnicalSchema, teacherFormSchema } from "./schemas";

describe("PROFILE_SECTIONS", () => {
  it("lists exactly the fields each schema validates", () => {
    const names = (key: keyof typeof PROFILE_SECTIONS) => PROFILE_SECTIONS[key].fields.map((f) => f.name).sort();
    expect(names("personal")).toEqual(Object.keys(myPersonalSchema.shape).sort());
    expect(names("technical")).toEqual(Object.keys(myTechnicalSchema.shape).sort());
    const all = [...names("personal"), ...names("administrative"), ...names("technical"), "name"].sort();
    expect(all).toEqual(Object.keys(teacherFormSchema.shape).sort());
  });
});

describe("readExtra", () => {
  it("keeps string values only", () => {
    expect(readExtra({ a: "x", b: 5, c: null, d: { e: 1 } })).toEqual({ a: "x", b: "5" });
    expect(readExtra(null)).toEqual({});
    expect(readExtra(["a"])).toEqual({});
  });
});

describe("mergeExtra", () => {
  const fields = [{ key: "blood" }, { key: "city" }];

  it("accepts only defined fields and keeps the rest of what is stored", () => {
    const out = mergeExtra({ blood: "A", legacy: "keep" }, { blood: " O ", hacked: "x" }, fields);
    expect(out).toEqual({ blood: "O", legacy: "keep" });
  });

  it("leaves fields that were not submitted untouched and allows clearing", () => {
    expect(mergeExtra({ blood: "A", city: "طنطا" }, { city: "" }, fields)).toEqual({ blood: "A", city: "" });
  });
});

describe("filterTeachers", () => {
  const rows = [
    { name: "عبد الله أحمد", phone: "01012345678" },
    { name: "إبراهيم", phone: "" },
  ];

  it("returns everything for an empty query", () => {
    expect(filterTeachers(rows, "  ")).toHaveLength(2);
  });

  it("matches names ignoring hamza and «عبد» spacing", () => {
    expect(filterTeachers(rows, "عبدالله احمد")).toEqual([rows[0]]);
    expect(filterTeachers(rows, "ابراهيم")).toEqual([rows[1]]);
  });

  it("matches part of the phone", () => {
    expect(filterTeachers(rows, "12345")).toEqual([rows[0]]);
    expect(filterTeachers(rows, "999")).toEqual([]);
  });
});
