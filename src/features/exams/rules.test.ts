import { describe, expect, it } from "vitest";

import {
  type ExamDraft,
  type ExaminerRelation,
  allowedExamTypes,
  canExamine,
  examDraftError,
  examinableTypes,
  positionText,
  questionCountOptions,
  questionLabel,
} from "./rules";

const who = (role: ExaminerRelation["role"], over: Partial<ExaminerRelation> = {}): ExaminerRelation => ({
  role,
  isTeacherOfHalaqa: false,
  isSupervisorOfHalaqa: false,
  ...over,
});

describe("allowedExamTypes", () => {
  it("lists the types each role may run", () => {
    expect(allowedExamTypes("ADMIN")).toEqual(["FOLLOW_UP", "PERIODIC", "MASTERY", "COMPETITION"]);
    expect(allowedExamTypes("SUPERVISOR")).toEqual(["FOLLOW_UP", "PERIODIC", "MASTERY", "COMPETITION"]);
    expect(allowedExamTypes("TEACHER")).toEqual(["PERIODIC"]);
    expect(allowedExamTypes("STUDENT")).toEqual([]);
    expect(allowedExamTypes("ACCOUNTANT")).toEqual([]);
  });
});

describe("canExamine", () => {
  it("lets the admin run everything for anyone", () => {
    expect(examinableTypes(who("ADMIN"))).toEqual(["FOLLOW_UP", "PERIODIC", "MASTERY", "COMPETITION"]);
  });

  it("lets a teacher run periodic exams for their own halaqa only", () => {
    expect(examinableTypes(who("TEACHER", { isTeacherOfHalaqa: true }))).toEqual(["PERIODIC"]);
    expect(examinableTypes(who("TEACHER"))).toEqual([]);
    expect(canExamine("FOLLOW_UP", who("TEACHER", { isTeacherOfHalaqa: true }))).toBe(false);
    expect(canExamine("COMPETITION", who("TEACHER", { isTeacherOfHalaqa: true }))).toBe(false);
  });

  it("lets the halaqa's supervisor run every type", () => {
    expect(examinableTypes(who("SUPERVISOR", { isSupervisorOfHalaqa: true }))).toEqual(["FOLLOW_UP", "PERIODIC", "MASTERY", "COMPETITION"]);
  });

  it("lets any supervisor run competition exams, and nothing else outside their halaqat", () => {
    expect(examinableTypes(who("SUPERVISOR"))).toEqual(["COMPETITION"]);
  });

  it("refuses students and accountants", () => {
    expect(examinableTypes(who("STUDENT", { isTeacherOfHalaqa: true, isSupervisorOfHalaqa: true }))).toEqual([]);
    expect(examinableTypes(who("ACCOUNTANT", { isSupervisorOfHalaqa: true }))).toEqual([]);
  });
});

describe("questions", () => {
  it("knows how many questions each type takes", () => {
    expect(questionCountOptions("FOLLOW_UP")).toEqual([2, 3]);
    expect(questionCountOptions("PERIODIC")).toEqual([2, 3]);
    expect(questionCountOptions("MASTERY")).toEqual([4]);
    expect(questionCountOptions("COMPETITION", { fromJuz: 30, toJuz: 30, questionCount: 5 })).toEqual([5]);
  });

  it("labels rows", () => {
    expect(questionLabel("FOLLOW_UP", 0, 2)).toBe("سؤال 1");
    expect(questionLabel("PERIODIC", 0, 2)).toBe("جديد");
    expect(questionLabel("PERIODIC", 1, 2)).toBe("مراجعة");
    expect(questionLabel("PERIODIC", 1, 3)).toBe("مراجعة 1");
    expect(questionLabel("PERIODIC", 2, 3)).toBe("مراجعة 2");
  });

  it("formats a position", () => {
    expect(positionText({ surah: 2, fromAyah: 5, toAyah: 9 })).toBe("سورة البقرة (5–9)");
    expect(positionText({ surah: 112, fromAyah: 1, toAyah: 1 })).toBe("سورة الإخلاص (1)");
  });
});

describe("examDraftError", () => {
  const q = (surah: number, fromAyah: number, toAyah?: number) => ({ surah, fromAyah, toAyah });
  const follow = (questions: ExamDraft["questions"]): ExamDraft => ({ type: "FOLLOW_UP", questions });

  it("accepts a valid follow-up exam", () => {
    expect(examDraftError(follow([q(2, 1, 5), q(3, 10)]))).toBeNull();
    expect(examDraftError(follow([q(2, 1, 5), q(3, 10), q(114, 1, 6)]))).toBeNull();
  });

  it("checks the number of questions", () => {
    expect(examDraftError(follow([q(2, 1)]))).toBe("عدد الأسئلة لا يوافق نوع الاختبار");
    expect(examDraftError(follow([q(2, 1), q(2, 2), q(2, 3), q(2, 4)]))).not.toBeNull();
    expect(examDraftError({ type: "MASTERY", juz: 30, questions: [q(78, 1), q(79, 1)] })).not.toBeNull();
  });

  it("requires a position for every question", () => {
    expect(examDraftError(follow([q(2, 1), {}]))).toBe("حدّد موضع «سؤال 2»");
    expect(examDraftError({ type: "PERIODIC", questions: [{ surah: 2 }, q(2, 1)] })).toBe("حدّد موضع «جديد»");
  });

  it("checks ayat against the surah", () => {
    expect(examDraftError(follow([q(1, 1, 8), q(2, 1)]))).toBe("آيات «سؤال 1» غير صحيحة (سورة الفاتحة 7 آية)");
    expect(examDraftError(follow([q(1, 5, 3), q(2, 1)]))).not.toBeNull();
    expect(examDraftError(follow([q(2, 1), q(2, 287)]))).not.toBeNull();
    expect(examDraftError(follow([q(115, 1), q(2, 1)]))).toBe("حدّد موضع «سؤال 1»");
  });

  it("rejects negative counts", () => {
    expect(examDraftError(follow([{ ...q(2, 1), mistakes: -1 }, q(2, 5)]))).toBe("عدد الأخطاء لا يكون سالبًا");
  });

  it("keeps mastery questions inside the juz", () => {
    const inside = [q(78, 1, 5), q(80, 1, 5), q(100, 1), q(114, 1, 6)];
    expect(examDraftError({ type: "MASTERY", juz: 30, questions: inside })).toBeNull();
    expect(examDraftError({ type: "MASTERY", questions: inside })).toBe("اختر الجزء");
    expect(examDraftError({ type: "MASTERY", juz: 30, questions: [q(77, 50), ...inside.slice(1)] })).toBe("موضع «سؤال 1» خارج الجزء 30");
    // Starts in juz 1 but runs into juz 2.
    expect(examDraftError({ type: "MASTERY", juz: 1, questions: [q(2, 140, 143), q(2, 1), q(2, 2), q(2, 3)] })).toBe("موضع «سؤال 1» خارج الجزء 1");
  });

  it("keeps competition questions inside the level's ajza and enforces its question count", () => {
    const level = { fromJuz: 29, toJuz: 30, questionCount: 3 };
    expect(examDraftError({ type: "COMPETITION", questions: [q(67, 1), q(78, 1), q(114, 1)] })).toBe("اختر المسابقة والمستوى");
    expect(examDraftError({ type: "COMPETITION", level, questions: [q(67, 1), q(78, 1), q(114, 1)] })).toBeNull();
    expect(examDraftError({ type: "COMPETITION", level, questions: [q(67, 1), q(78, 1)] })).toBe("عدد الأسئلة لا يوافق نوع الاختبار");
    expect(examDraftError({ type: "COMPETITION", level, questions: [q(66, 12), q(78, 1), q(114, 1)] })).toBe(
      "موضع «سؤال 1» خارج أجزاء المستوى (من 29 إلى 30)",
    );
  });
});
