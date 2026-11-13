import { describe, expect, it } from "vitest";

import { loginMessage, roleFromSlug, slugFromRole, whatsappLink, whatsappNumber } from "./domain";

describe("role slugs", () => {
  it("maps slugs to roles and back", () => {
    expect(roleFromSlug("students")).toBe("STUDENT");
    expect(roleFromSlug("admins")).toBe("ADMIN");
    expect(slugFromRole("ACCOUNTANT")).toBe("accountants");
  });

  it("falls back to teachers for unknown values", () => {
    expect(roleFromSlug(undefined)).toBe("TEACHER");
    expect(roleFromSlug("nope")).toBe("TEACHER");
    expect(roleFromSlug("constructor")).toBe("TEACHER");
  });
});

describe("whatsappNumber", () => {
  it("prefixes Egyptian mobiles with the country code", () => {
    expect(whatsappNumber("01012345678")).toBe("201012345678");
  });

  it("restores the dropped leading zero and reads Arabic digits", () => {
    expect(whatsappNumber("1012345678")).toBe("201012345678");
    expect(whatsappNumber("٠١٠١٢٣٤٥٦٧٨")).toBe("201012345678");
  });

  it("keeps numbers already in international form", () => {
    expect(whatsappNumber("+20 101 234 5678")).toBe("201012345678");
  });

  it("uses the first non-empty candidate only", () => {
    expect(whatsappNumber("", null, "01112345678", "01012345678")).toBe("201112345678");
    expect(whatsappNumber("123", "01012345678")).toBe("");
  });

  it("returns empty for missing or unusable numbers", () => {
    expect(whatsappNumber()).toBe("");
    expect(whatsappNumber("", undefined)).toBe("");
    expect(whatsappNumber("0223456789")).toBe("");
  });
});

describe("login message", () => {
  const text = loginMessage({ org: "دار النور", url: "https://example.org", name: "أحمد علي", password: "123456" });

  it("carries the name, password and link", () => {
    expect(text).toContain("بيانات دخولك إلى «دار النور»:");
    expect(text).toContain("الرابط: https://example.org");
    expect(text).toContain("الاسم: أحمد علي");
    expect(text).toContain("كلمة المرور: 123456");
  });

  it("is URL-encoded into the wa.me link", () => {
    const link = whatsappLink("201012345678", text);
    expect(link.startsWith("https://wa.me/201012345678?text=")).toBe(true);
    expect(decodeURIComponent(link.split("?text=")[1])).toBe(text);
    expect(whatsappLink("", "x")).toBe("https://wa.me/?text=x");
  });
});
