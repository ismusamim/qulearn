import { describe, expect, it } from "vitest";

import { resolvePermissions } from "@/lib/permissions";

import { FIXED_TASKS, type RoleSetting, TASK_GROUPS, memberAllows, planMemberOverrides, roleAllows } from "./matrix";

const settings: RoleSetting[] = [
  { role: "TEACHER", permission: "fees.collect", allowed: true },
  { role: "ACCOUNTANT", permission: "notes.send", allowed: false },
];

describe("roleAllows", () => {
  it("uses the built-in default when the admin made no choice", () => {
    expect(roleAllows([], "ACCOUNTANT", "fees.collect")).toBe(true);
    expect(roleAllows([], "TEACHER", "fees.collect")).toBe(false);
  });
  it("lets the admin grant and withdraw", () => {
    expect(roleAllows(settings, "TEACHER", "fees.collect")).toBe(true);
    expect(roleAllows(settings, "ACCOUNTANT", "notes.send")).toBe(false);
    expect(roleAllows(settings, "SUPERVISOR", "fees.collect")).toBe(false);
  });
});

describe("memberAllows", () => {
  it("lets the member override win over the role", () => {
    expect(memberAllows(settings, "TEACHER", [{ permission: "fees.collect", allowed: false }], "fees.collect")).toBe(false);
    expect(memberAllows(settings, "SUPERVISOR", [{ permission: "students.add", allowed: true }], "students.add")).toBe(true);
    expect(memberAllows(settings, "TEACHER", [], "fees.collect")).toBe(true);
  });
  it("agrees with the resolution used at login", () => {
    const overrides = [{ permission: "fees.collect" as const, allowed: false }];
    const resolved = resolvePermissions("TEACHER", settings.filter((s) => s.role === "TEACHER"), overrides);
    expect(resolved.has("fees.collect")).toBe(memberAllows(settings, "TEACHER", overrides, "fees.collect"));
  });
});

describe("planMemberOverrides", () => {
  it("stores only what differs from the role", () => {
    const plan = planMemberOverrides(settings, "TEACHER", [
      { permission: "fees.collect", allowed: true }, // same as role → no override
      { permission: "students.add", allowed: true }, // role has not → grant
      { permission: "notes.send", allowed: false }, // same as role
    ]);
    expect(plan.set).toEqual([{ permission: "students.add", allowed: true }]);
    expect(plan.remove).toEqual(["fees.collect", "notes.send"]);
  });
  it("can withdraw a role permission from one person", () => {
    const plan = planMemberOverrides([], "ACCOUNTANT", [{ permission: "fees.amount", allowed: false }]);
    expect(plan.set).toEqual([{ permission: "fees.amount", allowed: false }]);
    expect(plan.remove).toEqual([]);
  });
});

describe("task groups", () => {
  it("cover every fixed task", () => {
    for (const task of FIXED_TASKS) expect(TASK_GROUPS).toContain(task.group);
  });
});
