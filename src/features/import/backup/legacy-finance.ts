/**
 * Payroll, subscriptions, teacher collections and exams of the old app.
 *
 * Old → new field names:
 *   payroll.settings  perm/noperm → absenceWithPermission/absenceNoPermission, mperm/mnoperm →
 *                     meetingWithPermission/meetingNoPermission, round → roundTo, lv3/lv6 → leaveDays3/6,
 *                     hours → defaultHours, pin → pinHash (hashed), cls[empId] → employee.memberId
 *   payroll.employees role → jobTitle, sys → workSystem
 *   payroll.rows      y/m/eid → year/month/employeeId, base/extra/exc → base/extra/exceptionalHours,
 *                     absP/absN → absentWith/NoPermission, mtgP/mtgN → meetingsWith/NoPermission,
 *                     dTest/dRec/dBooks → deductionTest/Recitation/Books
 *   payroll.absences  eid → employeeId, perm → permission, by/byMember → recordedByName/recordedById
 *   fees              y/m → year/month, by/byMember → collectedByName/collectedById
 *   collections       accNote → accountantNote, reviewedBy → reviewedByName, lines[] → collectionLines
 *   exams             comp/level → competitionId/levelId, max → maxScore,
 *                     questions[].from/to/err/warn/taj → fromAyah/toAyah/mistakes/prompts/tajweedMistakes
 *   settings.exam_cfg q/err/warn/taj/b1..b4 → questionScore/…Penalty/excellentFrom/veryGoodFrom/goodFrom/passFrom
 */
import { fixName, normalizeArabic } from "@/lib/arabic";

import { singletonSchemas } from "./format";
import { type LegacyContext, MEMBER_SCOPES, STAFF_SCOPES } from "./legacy-context";
import * as v from "./legacy-values";

/** Discounts every old installation had even before the admin saved any. */
const DEFAULT_DISCOUNTS: v.Loose[] = [
  { id: "d_tahfeez", name: "أبناء موظفي التحفيظ", type: "pct", value: 0 },
  { id: "d_assoc", name: "أبناء موظفي الجمعية", type: "pct", value: 0 },
  { id: "d_orphan", name: "أيتام", type: "pct", value: 100 },
  { id: "d_special", name: "حالات خاصة", type: "pct", value: 0, each: true },
];

/** settings.priv_fees → fee categories and discounts. Must run before student profiles (they reference these ids). */
export function convertFeeConfig(ctx: LegacyContext, settings: v.Loose): void {
  const cfg = v.obj(settings.priv_fees);
  v.arr(cfg.cats).forEach((c, i) => {
    ctx.add("feeCategories", {
      id: ctx.ids.assign("feeCategories", c.id, `#${i}`),
      name: v.str(c.name),
      amount: v.num(c.amount) ?? 0,
      defaultFor: c.def === "child" ? "CHILD" : c.def === "adult" ? "ADULT" : null,
      sortOrder: i,
    });
  });
  // Before version 2 of the config «حالات خاصة» was not yet flagged as per-student.
  const saved = Array.isArray(cfg.discs);
  const discounts = saved ? v.arr(cfg.discs) : DEFAULT_DISCOUNTS;
  discounts.forEach((d, i) => {
    const perStudent = d.each === true || (saved && !cfg.v && d.id === "d_special");
    ctx.add("feeDiscounts", {
      id: ctx.ids.assign("feeDiscounts", d.id, `#${i}`),
      name: v.str(d.name),
      type: v.discountType(d.type),
      value: perStudent ? 0 : (v.num(d.value) ?? 0),
      perStudent,
      sortOrder: i,
    });
  });
}

export function convertFees(ctx: LegacyContext, db: v.Loose): void {
  v.arr(db.fees).forEach((f, i) => {
    const studentId = ctx.ids.get("students", f.studentId);
    if (!studentId) return ctx.report.skip("feePayments", "الطالب غير موجود");
    ctx.add("feePayments", {
      id: ctx.ids.assign("fees", f.id, `#${i}`),
      studentId,
      year: v.int(f.y),
      month: v.int(f.m),
      amount: v.num(f.amount) ?? 0,
      date: v.date(f.date),
      collectedById: ctx.ids.find(MEMBER_SCOPES, f.byMember),
      collectedByName: v.strOrNull(f.by),
      note: v.str(f.note),
    });
  });
}

export function convertCollections(ctx: LegacyContext, db: v.Loose): void {
  v.arr(db.collections).forEach((c, i) => {
    const teacherId = ctx.ids.get("teachers", c.teacherId);
    if (!teacherId) return ctx.report.skip("collections", "المعلم غير موجود");
    const id = ctx.ids.assign("collections", c.id, `#${i}`);
    const added = ctx.add("collections", {
      id,
      teacherId,
      teacherName: v.strOrNull(c.teacherName),
      halaqaId: ctx.ids.get("halaqat", c.halaqaId),
      year: v.int(c.y),
      month: v.int(c.m),
      status: v.collectionStatus(c.status),
      accountantNote: v.str(c.accNote),
      sentAt: v.timestamp(c.sentAt),
      reviewedByName: v.strOrNull(c.reviewedBy),
    });
    if (!added) return;
    for (const line of v.arr(c.lines)) {
      const studentId = ctx.ids.get("students", line.studentId);
      if (!studentId) {
        ctx.report.skip("collectionLines", "الطالب غير موجود");
        continue;
      }
      ctx.add("collectionLines", {
        id: ctx.ids.assign("collectionLines", null, `${id}:${studentId}`),
        collectionId: id,
        studentId,
        amount: v.num(line.amount) ?? 0,
        note: v.str(line.note),
        state: v.lineState(line.state),
        accountantNote: v.str(line.accNote),
      });
    }
  });
}

export function convertExams(ctx: LegacyContext, db: v.Loose, settings: v.Loose): void {
  const cfg = v.obj(settings.exam_cfg);
  if (Object.keys(cfg).length) {
    const parsed = singletonSchemas.examSettings.safeParse({
      questionScore: v.num(cfg.q) ?? undefined,
      mistakePenalty: v.num(cfg.err) ?? undefined,
      promptPenalty: v.num(cfg.warn) ?? undefined,
      tajweedPenalty: v.num(cfg.taj) ?? undefined,
      excellentFrom: v.int(cfg.b1) ?? undefined,
      veryGoodFrom: v.int(cfg.b2) ?? undefined,
      goodFrom: v.int(cfg.b3) ?? undefined,
      passFrom: v.int(cfg.b4) ?? undefined,
    });
    if (parsed.success) ctx.data.examSettings = parsed.data;
  }

  const names = new Map<string, string>();
  v.arr(settings.exam_comps).forEach((c, i) => {
    const id = ctx.ids.assign("competitions", c.id, `#${i}`);
    if (!ctx.add("competitions", { id, name: v.str(c.name) })) return;
    names.set(id, v.str(c.name));
    v.arr(c.levels).forEach((l, j) => {
      const levelId = ctx.ids.assign("competitionLevels", l.id, `${id}#${j}`);
      const ok = ctx.add("competitionLevels", {
        id: levelId, competitionId: id, name: v.str(l.name), fromJuz: v.int(l.from), toJuz: v.int(l.to), questionCount: v.int(l.q),
      });
      if (ok) names.set(levelId, v.str(l.name));
    });
  });

  v.arr(db.exams).forEach((e, i) => {
    const studentId = ctx.ids.get("students", e.studentId);
    if (!studentId) return ctx.report.skip("exams", "الطالب غير موجود");
    const type = v.examType(e.type);
    if (!type) return ctx.report.skip("exams", "نوع اختبار غير معروف");
    const id = ctx.ids.assign("exams", e.id, `#${i}`);
    const competitionId = ctx.ids.get("competitions", e.comp);
    const levelId = ctx.ids.get("competitionLevels", e.level);
    const added = ctx.add("exams", {
      id,
      studentId,
      halaqaId: ctx.ids.get("halaqat", e.halaqaId),
      type,
      date: v.date(e.date) ?? ctx.today,
      examinerId: ctx.ids.find(STAFF_SCOPES, e.examinerId),
      examinerName: v.strOrNull(e.examinerName),
      juz: v.int(e.juz),
      competitionId,
      competitionName: competitionId ? (names.get(competitionId) ?? null) : null,
      levelId,
      levelName: levelId ? (names.get(levelId) ?? null) : null,
      maxScore: v.num(e.max),
      total: v.num(e.total),
      grade: v.strOrNull(e.grade),
      note: v.str(e.note),
    });
    if (!added) return;
    v.arr(e.questions).forEach((q, position) => {
      ctx.add("examQuestions", {
        id: ctx.ids.assign("examQuestions", null, `${id}:${position}`),
        examId: id,
        position,
        label: v.str(q.label),
        surah: v.int(q.surah),
        fromAyah: v.int(q.from),
        toAyah: v.int(q.to) ?? v.int(q.from),
        mistakes: v.int(q.err) ?? 0,
        prompts: v.int(q.warn) ?? 0,
        tajweedMistakes: v.int(q.taj) ?? 0,
        score: v.num(q.score) ?? 0,
      });
    });
  });
}

/** The account an employee belongs to: the admin's explicit classification, else a unique name match among staff. */
function employeeMember(ctx: LegacyContext, db: v.Loose, employee: v.Loose, cls: v.Loose): string | null {
  const link = v.obj(cls[v.str(employee.id)]);
  const scope = { teacher: "teachers", supervisor: "supervisors", admin: "admins" }[v.str(link.kind)];
  if (scope) {
    const id = ctx.ids.get(scope, link.memberId);
    if (id) return id;
  }
  const key = normalizeArabic(v.str(employee.name));
  const hits = (["teachers", "supervisors", "admins"] as const).flatMap((s) =>
    v.arr(db[s]).filter((m) => normalizeArabic(v.str(m.name)) === key).map((m) => ctx.ids.get(s, m.id)),
  );
  return hits.length === 1 ? hits[0] : null;
}

export function convertPayroll(ctx: LegacyContext, db: v.Loose): void {
  if (!db.payroll || typeof db.payroll !== "object") return;
  const p = v.obj(db.payroll);
  const s = v.obj(p.settings);

  const settings = singletonSchemas.payrollSettings.safeParse({
    absenceWithPermission: v.num(s.perm) ?? undefined,
    absenceNoPermission: v.num(s.noperm) ?? undefined,
    meetingWithPermission: v.num(s.mperm) ?? undefined,
    meetingNoPermission: v.num(s.mnoperm) ?? undefined,
    roundTo: v.int(s.round) ?? undefined,
    leaveDays3: v.int(s.lv3) ?? undefined,
    leaveDays6: v.int(s.lv6) ?? undefined,
    defaultHours: v.num(s.hours) ?? undefined,
    pinHash: null,
  });
  if (settings.success) ctx.data.payrollSettings = settings.data;
  ctx.payrollPin = v.strOrNull(s.pin);

  v.arr(p.employees).forEach((e, i) => {
    ctx.add("employees", {
      id: ctx.ids.assign("employees", e.id, `#${i}`),
      code: v.strOrNull(e.code),
      name: fixName(v.str(e.name)),
      jobTitle: v.strOrNull(e.role),
      workSystem: v.strOrNull(e.sys),
      status: v.employeeStatus(e.status),
      basic: v.num(e.basic),
      rate: v.num(e.rate),
      incentive: v.num(e.incentive),
      transport: v.num(e.transport),
      hours: v.num(e.hours),
      place: v.strOrNull(e.place),
      note: v.strOrNull(e.note),
      memberId: employeeMember(ctx, db, e, v.obj(s.cls)),
    });
  });

  v.arr(p.rows).forEach((r, i) => {
    const employeeId = ctx.ids.get("employees", r.eid);
    if (!employeeId) return ctx.report.skip("payrollRows", "الموظف غير موجود");
    ctx.add("payrollRows", {
      id: ctx.ids.assign("payrollRows", r.id, `#${i}`),
      year: v.int(r.y),
      month: v.int(r.m),
      employeeId,
      name: v.strOrNull(r.name) && fixName(v.str(r.name)),
      jobTitle: v.strOrNull(r.role),
      baseHours: v.num(r.base),
      extraHours: v.num(r.extra),
      exceptionalHours: v.num(r.exc),
      absentWithPermission: v.num(r.absP),
      absentNoPermission: v.num(r.absN),
      meetingsWithPermission: v.num(r.mtgP),
      meetingsNoPermission: v.num(r.mtgN),
      deductionTest: v.num(r.dTest),
      deductionRecitation: v.num(r.dRec),
      deductionBooks: v.num(r.dBooks),
      basic: v.num(r.basic),
      rate: v.num(r.rate),
      incentive: v.num(r.incentive),
      transport: v.num(r.transport),
      note: v.str(r.note),
    });
  });

  // Closed months were stored as "2025-3".
  for (const key of Array.isArray(p.closed) ? p.closed : []) {
    const [year, month] = String(key).split("-").map(Number);
    ctx.add("payrollClosedMonths", { year, month });
  }

  v.arr(p.absences).forEach((a, i) => {
    const employeeId = ctx.ids.get("employees", a.eid);
    if (!employeeId) return ctx.report.skip("teacherAbsences", "الموظف غير موجود");
    const date = v.date(a.date);
    if (!date) return ctx.report.skip("teacherAbsences", "غياب بلا تاريخ");
    ctx.add("teacherAbsences", {
      id: ctx.ids.assign("absences", a.id, `#${i}`),
      year: v.int(a.y) ?? Number(date.slice(0, 4)),
      month: v.int(a.m) ?? Number(date.slice(5, 7)),
      date,
      employeeId,
      name: v.strOrNull(a.name),
      place: v.strOrNull(a.place),
      permission: v.absencePermission(a.perm),
      reason: v.strOrNull(a.reason),
      proof: v.absenceProof(a.proof),
      note: v.strOrNull(a.note),
      recordedById: ctx.ids.find(MEMBER_SCOPES, a.byMember),
      recordedByName: v.strOrNull(a.by),
      createdAt: v.timestamp(a.ts) ?? undefined,
    });
  });
}
