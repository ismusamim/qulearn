import { describe, expect, it } from "vitest";

import { keepCurrentAdmin, remapIds } from "./current-admin";
import { backupDataSchema } from "./format";

const ME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OLD = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const me = { id: ME, role: "ADMIN" as const, name: "المدير", phone: "", passwordHash: "hash-now", photo: null, extra: {} };

describe("keepCurrentAdmin", () => {
  it("adds the current admin when the backup does not know them", () => {
    const data = keepCurrentAdmin(backupDataSchema.parse({ members: [{ id: OLD, role: "ADMIN", name: "مدير آخر" }] }), me);
    expect(data.members.map((m) => m.id)).toEqual([OLD, ME]);
  });

  it("takes over a same-named admin, rewriting references, and keeps the current password", () => {
    const data = keepCurrentAdmin(
      backupDataSchema.parse({
        members: [{ id: OLD, role: "ADMIN", name: "المدير", passwordHash: "hash-old", phone: "0100" }],
        news: [{ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", text: "x", date: "2025-01-01", authorId: OLD }],
      }),
      me,
    );
    expect(data.members).toEqual([{ ...me, phone: "0100" }]);
    expect(data.news[0].authorId).toBe(ME);
  });

  it("keeps the current password when the backup has the same id", () => {
    const data = keepCurrentAdmin(backupDataSchema.parse({ members: [{ id: ME, role: "ADMIN", name: "اسم قديم", passwordHash: null }] }), me);
    expect(data.members[0]).toMatchObject({ name: "اسم قديم", passwordHash: "hash-now" });
  });
});

describe("remapIds", () => {
  it("replaces ids wherever they appear and leaves other text alone", () => {
    const out = remapIds({ a: OLD.toUpperCase(), b: [`x ${OLD} y`], c: "bbbbbbbb" }, new Map([[OLD, ME]]));
    expect(out).toEqual({ a: ME, b: [`x ${ME} y`], c: "bbbbbbbb" });
  });
});
