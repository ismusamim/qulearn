import { describe, expect, it } from "vitest";

import { canDeleteNews, canReadNews, noteAuthorLabel } from "./visibility";

const teacher = { memberId: "t1", role: "TEACHER" as const };
const admin = { memberId: "a1", role: "ADMIN" as const };
const accountant = { memberId: "c1", role: "ACCOUNTANT" as const };

describe("canReadNews", () => {
  it("shows items for everyone to everyone", () => {
    expect(canReadNews(teacher, { audience: "ALL", authorId: null })).toBe(true);
  });
  it("shows role items to that role only", () => {
    expect(canReadNews(teacher, { audience: "TEACHER", authorId: null })).toBe(true);
    expect(canReadNews(teacher, { audience: "SUPERVISOR", authorId: null })).toBe(false);
    expect(canReadNews(teacher, { audience: "ADMIN", authorId: "c1" })).toBe(false);
  });
  it("shows everything to admins", () => {
    expect(canReadNews(admin, { audience: "STUDENT", authorId: null })).toBe(true);
  });
  it("shows a note to its author whatever the audience", () => {
    expect(canReadNews(accountant, { audience: "ADMIN", authorId: "c1" })).toBe(true);
    expect(canReadNews(accountant, { audience: "SUPERVISOR", authorId: "other" })).toBe(false);
  });
});

describe("canDeleteNews", () => {
  it("lets admins delete anything and authors their own", () => {
    expect(canDeleteNews(admin, { audience: "ALL", authorId: null })).toBe(true);
    expect(canDeleteNews(accountant, { audience: "ADMIN", authorId: "c1" })).toBe(true);
    expect(canDeleteNews(accountant, { audience: "ALL", authorId: null })).toBe(false);
    expect(canDeleteNews(teacher, { audience: "TEACHER", authorId: "c1" })).toBe(false);
  });
});

describe("noteAuthorLabel", () => {
  it("prefixes the role title", () => {
    expect(noteAuthorLabel("ACCOUNTANT", "أحمد علي")).toBe("المحاسب أحمد علي");
    expect(noteAuthorLabel("SUPERVISOR", "خالد")).toBe("المشرف خالد");
  });
});
