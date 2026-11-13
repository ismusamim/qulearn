import { describe, expect, it } from "vitest";

import {
  isLocked,
  linesTotal,
  parseReviewFilter,
  paymentNote,
  pickNewLines,
  planReview,
  resolveCollectionStatus,
} from "./logic";

describe("pickNewLines", () => {
  const halaqa = new Set(["a", "b", "c", "d"]);

  it("keeps only lines with an amount or a note", () => {
    const lines = pickNewLines(
      [
        { studentId: "a", amount: 50, note: "" },
        { studentId: "b", amount: 0, note: "  سافر  " },
        { studentId: "c", amount: 0, note: "   " },
      ],
      halaqa,
      new Set(),
    );
    expect(lines).toEqual([
      { studentId: "a", amount: 50, note: "" },
      { studentId: "b", amount: 0, note: "سافر" },
    ]);
  });

  it("drops students outside the halaqa and lines already confirmed", () => {
    const lines = pickNewLines(
      [
        { studentId: "x", amount: 50, note: "" },
        { studentId: "a", amount: 70, note: "" },
        { studentId: "b", amount: 30, note: "" },
      ],
      halaqa,
      new Set(["a"]),
    );
    expect(lines.map((l) => l.studentId)).toEqual(["b"]);
  });

  it("clamps negative amounts, truncates notes and keeps the last duplicate", () => {
    const lines = pickNewLines(
      [
        { studentId: "a", amount: -20, note: "" },
        { studentId: "b", amount: 10, note: "x".repeat(400) },
        { studentId: "c", amount: 10, note: "" },
        { studentId: "c", amount: 25.555, note: "" },
        { studentId: "d", amount: 10, note: "" },
        { studentId: "d", amount: 0, note: "" },
      ],
      halaqa,
      new Set(),
    );
    expect(lines).toHaveLength(2);
    expect(lines[0].note).toHaveLength(300);
    expect(lines[1]).toEqual({ studentId: "c", amount: 25.56, note: "" });
  });
});

describe("resolveCollectionStatus", () => {
  it("returns the list when anything has an issue", () => {
    expect(resolveCollectionStatus(1, 0)).toBe("RETURNED");
    expect(resolveCollectionStatus(2, 3)).toBe("RETURNED");
  });
  it("stays with the accountant while lines are undecided", () => {
    expect(resolveCollectionStatus(0, 1)).toBe("SENT");
  });
  it("is done when every line is confirmed", () => {
    expect(resolveCollectionStatus(0, 0)).toBe("DONE");
  });
});

describe("planReview", () => {
  const pending = [
    { id: "l1", studentId: "a", amount: 100, note: "" },
    { id: "l2", studentId: "b", amount: 0, note: "لم يدفع" },
    { id: "l3", studentId: "c", amount: 60, note: "" },
  ];

  it("confirms, returns and leaves undecided lines pending", () => {
    const plan = planReview(pending, [
      { studentId: "a", ok: true, note: "" },
      { studentId: "b", ok: false, note: "المبلغ ناقص" },
    ]);
    expect(plan.confirmed.map((l) => l.id)).toEqual(["l1"]);
    expect(plan.returned).toEqual([{ id: "l2", accountantNote: "المبلغ ناقص" }]);
    expect(plan.pending).toBe(1);
    expect(plan.status).toBe("RETURNED");
  });

  it("is done when all pending lines are confirmed, and ignores decisions for other students", () => {
    const plan = planReview(pending, [
      { studentId: "a", ok: true, note: "" },
      { studentId: "b", ok: true, note: "تمام" },
      { studentId: "c", ok: true, note: "" },
      { studentId: "zzz", ok: false, note: "x" },
    ]);
    expect(plan.status).toBe("DONE");
    expect(plan.confirmed).toHaveLength(3);
    expect(plan.confirmed[1].accountantNote).toBe("تمام");
    expect(plan.returned).toHaveLength(0);
  });

  it("stays SENT when some lines get no decision and none is returned", () => {
    expect(planReview(pending, [{ studentId: "a", ok: true, note: "" }]).status).toBe("SENT");
  });

  it("an empty list of pending lines is DONE", () => {
    expect(planReview([], []).status).toBe("DONE");
  });
});

describe("helpers", () => {
  it("builds the payment note", () => {
    expect(paymentNote("أحمد", "")).toBe("تحصيل المعلم أحمد");
    expect(paymentNote("أحمد", "عن أخيه")).toBe("تحصيل المعلم أحمد — عن أخيه");
    expect(paymentNote(null, "")).toBe("تحصيل المعلم ");
  });
  it("locks sent and done lists", () => {
    expect([null, "DRAFT", "RETURNED", "SENT", "DONE"].map((s) => isLocked(s as never))).toEqual([false, false, false, true, true]);
  });
  it("totals lines", () => {
    expect(linesTotal([{ amount: 10.1 }, { amount: null }, { amount: 20.2 }])).toBe(30.3);
  });
  it("defaults the review filter to sent", () => {
    expect(parseReviewFilter("done")).toBe("done");
    expect(parseReviewFilter("draft")).toBe("sent");
    expect(parseReviewFilter(undefined)).toBe("sent");
  });
});
