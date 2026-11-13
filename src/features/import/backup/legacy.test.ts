import { describe, expect, it } from "vitest";

import { backupDataSchema, emptyBackupData } from "./format";
import { normalizeBackup } from "./integrity";
import { convertLegacyBackup, isLegacyBackup } from "./legacy";
import { isUuid, stableUuid } from "./legacy-ids";
import { schedule, theme } from "./legacy-values";
import { ReportBuilder } from "./report";

const TEACHER_UUID = "0b9c3f0e-5d0a-4a43-9d0a-2f1f3a6b7c8d";

/** A small but complete old-app document, mixing short ids and UUIDs. */
function legacyDoc() {
  return {
    settings: {
      org: "دار النور",
      logo: "data:image/png;base64,AAAA",
      theme: { navy: "#112233", gold: "#aabbcc", stripe: "#ffffff", bg: "oops" },
      block_msgs: { student: "موقوف", teacher: "" },
      col_labels: { students: { name: "الطالب" } },
      priv_fees: {
        v: 2,
        cats: [{ id: "c1", name: "صغار", amount: "50", def: "child" }, { id: "c2", name: "كبار", amount: 80, def: "adult" }],
        discs: [{ id: "d_orphan", name: "أيتام", type: "pct", value: 100 }, { id: "d_special", name: "حالات خاصة", type: "amt", value: 5, each: true }],
      },
      priv_perms: { roles: { teacher: { "fees.collect": true, "no.such": true } }, members: { acc1: { "students.add": false }, ghost: { "students.add": true } } },
      exam_cfg: { q: 20, err: 2, b1: 95 },
      exam_comps: [{ id: "cp1", name: "مسابقة رمضان", levels: [{ id: "lv1", name: "الأول", from: 1, to: 5, q: 3 }] }],
    },
    admins: [{ id: "a1", name: "المدير", pin: "1234" }],
    supervisors: [{ id: "s1", name: "المشرف خالد", phone: "", pin: "0000" }],
    accountants: [{ id: "acc1", name: "المحاسب سعيد", pin: "0000" }],
    teachers: [
      {
        id: TEACHER_UUID, name: "الشيخ عبدالله", phone: "1012345678",
        personal: { fullName: "عبد الله محمد", birth: "1980-01-02", email: "a@b.c" },
        admin: { status: "موقوف", pay: "1500", empNo: 7 },
        tech: { memorized: "30", exp: 12, riwaya: "حفص عن عاصم" },
      },
      { id: "t2", name: "الشيخ أحمد", pin: "0000" },
    ],
    places: [{ id: "p1", name: "المسجد الكبير", type: "مسجد" }, { id: "p2", name: "دار الهدى", type: "دار تحفيظ" }],
    halaqat: [
      { id: "h1", teacherId: TEACHER_UUID, supervisorId: "s1", placeId: "p1", time: { mode: "prayer", fromPrayer: "العصر", toKind: "clock", toTime: "18:30" } },
      { id: "h2", name: "حلقة الفجر", teacherId: "t2", supervisorId: "", placeId: "p2", time: { mode: "clock", from: "7:00", to: "09:00" } },
      { id: "h3", name: "قديمة", teacherId: "gone", schedule: "بعد صلاة المغرب" },
    ],
    students: [
      {
        id: "st1", name: "يوسف", halaqaId: "h1", cat: "child", phone: "01000000001", pin: "111111", extra: { f_x: "قيمة" }, photo: "data:image/jpeg;base64,BBBB",
        info: {
          nid: "30501011234567", birth: "2005-01-01", gName: "أحمد", gPhone: "1000000002", gRel: "الأب", grade: "الصف الأول الابتدائي",
          test: { read: "جيد", tajweed: "ممتاز", hifz: "جزء عم" }, pledge: true, fee: "", feeCat: "c1", feeDisc: "d_special",
          feeDiscVal: 10, feeDiscType: "amt", status: "منقطع", statusDate: "2025-02-01", joinDate: "2024-09-01",
        },
      },
      { id: "st2", name: "عمر", halaqaId: "h2", cat: "adult", info: { birthYear: 1990, marital: "متزوج", qual: "جامعي", fee: 120, feeCat: "nope" } },
      { id: "st3", name: "  ", halaqaId: "h1" },
    ],
    attendance: [
      { id: "at1", studentId: "st1", date: "2025-01-05", status: "present" },
      { id: "at2", studentId: "st1", date: "2025-01-05", status: "late" },
      { id: "at3", studentId: "missing", date: "2025-01-05", status: "absent" },
      { id: "at4", studentId: "st2", date: "2025-01-05", status: "weird" },
    ],
    records: [
      { id: "r1", studentId: "st1", date: "2025-01-05", type: "حفظ", surah: "2", from: "1", to: "5", grade: "ممتاز", note: "" },
      { id: "r2", studentId: "st1", date: "2025-01-06", type: "تثبيت", surah: 200, from: 1, to: 2 },
    ],
    news: [{ id: "n1", text: "إعلان", audience: "teacher", date: "2025-01-01" }, { id: "n2", text: "ملاحظة", audience: "admin", date: "2025-01-02", author: "المحاسب سعيد", authorId: "acc1" }],
    fields: { students: [{ key: "f_x", label: "حقل", type: "number" }], teachers: [] },
    pending: [{ id: "pd1", kind: "students", header: "لون", date: "2025-01-01", values: [{ mid: "st1", v: "أزرق" }, { mid: "zzz", v: "x" }] }],
    payroll: {
      settings: { perm: 25, noperm: 35, round: 10, lv3: 12, hours: "24", pin: "9999", cls: { e1: { kind: "teacher", memberId: TEACHER_UUID } } },
      employees: [{ id: "e1", name: "عبدالله", role: "معلم", sys: "(3) أيام", status: "متوقف", basic: 1000, rate: "20" }, { id: "e2", name: "الشيخ أحمد", status: "نشط" }],
      rows: [{ id: "pr1", y: 2025, m: 1, eid: "e1", name: "عبدالله", role: "معلم", base: 26, extra: 2, absP: 1, mtgN: 1, dBooks: 15, basic: 1000, note: "" }, { id: "pr2", y: 2025, m: 1, eid: "nobody" }],
      closed: ["2024-12", "bad"],
      absences: [
        { id: "ab1", y: 2025, m: 1, date: "2025-01-07", eid: "e1", perm: "بغير إذن", proof: "رصيد", by: "المشرف خالد", byMember: "s1" },
        { id: "ab2", y: 2025, m: 1, date: "", eid: "e1" },
      ],
    },
    fees: [{ id: "f1", studentId: "st1", y: 2025, m: 1, amount: "40", date: "2025-01-10", by: "المحاسب سعيد", byMember: "acc1", note: "" }],
    collections: [{ id: "cl1", teacherId: TEACHER_UUID, teacherName: "الشيخ عبد الله", halaqaId: "h1", y: 2025, m: 1, status: "returned", accNote: "راجع", sentAt: "2025-01-11T10:00:00Z", reviewedBy: "سعيد", lines: [{ studentId: "st1", amount: 40, note: "", state: "issue", accNote: "ناقص" }, { studentId: "ghost", amount: 1 }] }],
    exams: [
      { id: "ex1", studentId: "st1", halaqaId: "h1", type: "comp", date: "2025-01-12", examinerId: "s1", examinerName: "المشرف خالد", comp: "cp1", level: "lv1", max: 40, total: 36.5, grade: "ممتاز", questions: [{ label: "1", surah: 2, from: 1, to: 5, err: 1, warn: 2, taj: 0, score: 17 }, { label: "2", surah: 3, from: 1, to: "", err: 0, score: 19.5 }] },
      { id: "ex2", studentId: "st1", type: "unknown", date: "2025-01-12" },
    ],
  };
}

const convert = () => convertLegacyBackup(legacyDoc(), { today: "2025-06-01" });

describe("legacy ids", () => {
  it("derives stable, valid UUIDs", () => {
    expect(isUuid(stableUuid("students:st1"))).toBe(true);
    expect(stableUuid("students:st1")).toBe(stableUuid("students:st1"));
    expect(stableUuid("students:st1")).not.toBe(stableUuid("teachers:st1"));
  });
});

describe("legacy values", () => {
  it("maps halaqa.time to schedule columns", () => {
    expect(schedule({ mode: "clock", from: "7:00", to: "09:00" }, "")).toMatchObject({ scheduleMode: "CLOCK", startTime: "07:00", endTime: "09:00" });
    expect(schedule({ mode: "prayer", fromPrayer: "العصر", toKind: "prayer", toPrayer: "المغرب" }, "")).toMatchObject({ scheduleMode: "PRAYER", startPrayer: "العصر", endPrayer: "المغرب", endTime: null });
    expect(schedule(undefined, "بعد صلاة المغرب")).toMatchObject({ scheduleMode: "PRAYER", startPrayer: "المغرب" });
    expect(schedule(undefined, "")).toMatchObject({ scheduleMode: null });
  });

  it("renames theme keys and drops invalid colours", () => {
    expect(theme({ navy: "#112233", gold: "#aabbcc", leaf: "#010203", amber: "#040506", red: "#070809", text: "#000000", bg: "nope", stripe: "#ffffff" })).toEqual({
      primary: "#112233", accent: "#aabbcc", success: "#010203", warning: "#040506", danger: "#070809", text: "#000000",
    });
  });
});

describe("convertLegacyBackup", () => {
  it("recognises old backups", () => {
    expect(isLegacyBackup(legacyDoc())).toBe(true);
    expect(isLegacyBackup({ settings: {}, students: [] })).toBe(false);
    expect(() => convertLegacyBackup({ format: "qulearn-backup" }, { today: "2025-06-01" })).toThrow();
  });

  it("produces data that satisfies the backup format", () => {
    const { data } = convert();
    expect(backupDataSchema.parse(JSON.parse(JSON.stringify(data)))).toEqual(data);
  });

  it("keeps UUID ids, remaps short ids consistently, and is deterministic", () => {
    const a = convert().data;
    const b = convert().data;
    expect(a).toEqual(b);
    const teacher = a.members.find((m) => m.name === "الشيخ عبد الله")!;
    expect(teacher.id).toBe(TEACHER_UUID);
    const st1 = a.members.find((m) => m.name === "يوسف")!;
    expect(isUuid(st1.id)).toBe(true);
    const h1 = a.halaqat.find((h) => h.teacherId === TEACHER_UUID)!;
    expect(a.studentProfiles.find((p) => p.memberId === st1.id)!.halaqaId).toBe(h1.id);
    expect(h1.supervisorId).toBe(a.members.find((m) => m.role === "SUPERVISOR")!.id);
    expect(h1.placeId).toBe(a.places.find((p) => p.name === "المسجد الكبير")!.id);
    expect(a.attendance.every((x) => x.studentId === st1.id)).toBe(true);
  });

  it("converts members, pins and profiles", () => {
    const { data, pins } = convert();
    expect(data.members.map((m) => m.role).sort()).toEqual(["ACCOUNTANT", "ADMIN", "STUDENT", "STUDENT", "SUPERVISOR", "TEACHER", "TEACHER"]);
    expect(data.members.every((m) => m.passwordHash === null)).toBe(true);
    const st1 = data.members.find((m) => m.name === "يوسف")!;
    expect(pins[st1.id]).toBe("111111");
    expect(st1).toMatchObject({ phone: "01000000001", extra: { f_x: "قيمة" }, photo: "data:image/jpeg;base64,BBBB" });
    expect(pins[TEACHER_UUID]).toBeUndefined();

    const p1 = data.studentProfiles.find((p) => p.memberId === st1.id)!;
    expect(p1).toMatchObject({
      category: "CHILD", status: "DROPPED", statusDate: "2025-02-01", nationalId: "30501011234567", birthDate: "2005-01-01",
      guardianName: "أحمد", guardianPhone: "01000000002", guardianRelation: "الأب", testReading: "جيد", testTajweed: "ممتاز",
      testHifz: "جزء عم", pledgeSigned: true, monthlyFee: null, joinDate: "2024-09-01", feeDiscountValue: 10, feeDiscountType: "AMOUNT",
    });
    expect(p1.feeCategoryId).toBe(data.feeCategories.find((c) => c.name === "صغار")!.id);
    expect(p1.feeDiscountId).toBe(data.feeDiscounts.find((d) => d.name === "حالات خاصة")!.id);

    const p2 = data.studentProfiles.find((p) => p.memberId !== st1.id)!;
    expect(p2).toMatchObject({ category: "ADULT", status: "ACTIVE", birthYear: 1990, maritalStatus: "متزوج", monthlyFee: 120, feeCategoryId: null });

    expect(data.teacherProfiles.find((p) => p.memberId === TEACHER_UUID)).toMatchObject({
      fullName: "عبد الله محمد", birthDate: "1980-01-02", email: "a@b.c", status: "SUSPENDED", monthlyPay: 1500, employeeNo: "7",
      memorizedParts: 30, experienceYears: 12, riwaya: "حفص عن عاصم",
    });
    // The teacher without a file still gets a default profile.
    expect(data.teacherProfiles).toHaveLength(2);
  });

  it("converts places, halaqat and schedules", () => {
    const { data } = convert();
    expect(data.places.map((p) => p.type)).toEqual(["MOSQUE", "DAR"]);
    expect(data.halaqat.find((h) => h.teacherId === TEACHER_UUID)).toMatchObject({ scheduleMode: "PRAYER", startPrayer: "العصر", endPrayer: null, endTime: "18:30" });
    expect(data.halaqat.find((h) => h.name === "حلقة الفجر")).toMatchObject({ scheduleMode: "CLOCK", startTime: "07:00", endTime: "09:00", supervisorId: null });
    expect(data.halaqat.find((h) => h.name === "قديمة")).toMatchObject({ teacherId: null, scheduleMode: "PRAYER", startPrayer: "المغرب" });
  });

  it("converts attendance, recitations, news, fields and pending", () => {
    const { data, report } = convert();
    // Two rows for the same student and day: the later one wins.
    expect(data.attendance).toHaveLength(1);
    expect(data.attendance[0].status).toBe("LATE");
    expect(data.recitations).toHaveLength(1);
    expect(data.recitations[0]).toMatchObject({ type: "HIFZ", surah: 2, fromAyah: 1, toAyah: 5, grade: "ممتاز" });
    expect(data.news.map((n) => n.audience)).toEqual(["TEACHER", "ADMIN"]);
    expect(data.news[1]).toMatchObject({ authorLabel: "المحاسب سعيد", authorId: data.members.find((m) => m.role === "ACCOUNTANT")!.id });
    expect(data.news[0].createdAt! < data.news[1].createdAt!).toBe(true);
    expect(data.customFields).toEqual([{ kind: "STUDENTS", key: "f_x", label: "حقل", type: "NUMBER" }]);
    expect(data.pendingColumns[0].values).toEqual([{ memberId: data.members.find((m) => m.name === "يوسف")!.id, name: "يوسف", value: "أزرق" }]);

    const reasons = report.skipped.map((s) => `${s.table}:${s.reason}:${s.count}`);
    expect(reasons).toContain("members:حساب بلا اسم:1");
    expect(reasons).toContain("attendance:الطالب غير موجود:1");
    expect(reasons).toContain("attendance:حالة حضور غير معروفة:1");
    expect(reasons).toContain("attendance:تسجيل مكرر للطالب في اليوم نفسه:1");
    expect(reasons).toContain("recitations:قيمة غير صالحة في «surah»:1");
  });

  it("converts settings and permissions", () => {
    const { data, report } = convert();
    const settings = Object.fromEntries(data.settings.map((s) => [s.key, s.value]));
    expect(settings).toEqual({
      org: "دار النور",
      logo: "data:image/png;base64,AAAA",
      theme: { primary: "#112233", accent: "#aabbcc" },
      blockMessages: { student: "موقوف" },
    });
    expect(data.rolePermissions).toEqual([{ role: "TEACHER", permission: "fees.collect", allowed: true }]);
    expect(data.memberPermissions).toEqual([{ memberId: data.members.find((m) => m.role === "ACCOUNTANT")!.id, permission: "students.add", allowed: false }]);
    expect(report.notes.some((n) => n.includes("col_labels"))).toBe(true);
    expect(report.notes.some((n) => n.includes("بلا كلمة مرور"))).toBe(true);
  });

  it("converts payroll with the new field names", () => {
    const { data, payrollPin, report } = convert();
    expect(payrollPin).toBe("9999");
    expect(data.payrollSettings).toEqual({
      absenceWithPermission: 25, absenceNoPermission: 35, meetingWithPermission: 50, meetingNoPermission: 70,
      roundTo: 10, leaveDays3: 12, leaveDays6: 21, defaultHours: 24, pinHash: null,
    });
    const [e1, e2] = data.employees;
    expect(e1).toMatchObject({ name: "عبد الله", jobTitle: "معلم", workSystem: "(3) أيام", status: "STOPPED", basic: 1000, rate: 20, memberId: TEACHER_UUID });
    // No explicit classification: linked by the one account with the same name.
    expect(e2.memberId).toBe(data.members.find((m) => m.name === "الشيخ أحمد")!.id);
    expect(data.payrollRows).toHaveLength(1);
    expect(data.payrollRows[0]).toMatchObject({
      year: 2025, month: 1, employeeId: e1.id, jobTitle: "معلم", baseHours: 26, extraHours: 2, absentWithPermission: 1,
      meetingsNoPermission: 1, deductionBooks: 15, basic: 1000, exceptionalHours: null,
    });
    expect(data.payrollClosedMonths).toEqual([{ year: 2024, month: 12 }]);
    expect(data.teacherAbsences).toHaveLength(1);
    expect(data.teacherAbsences[0]).toMatchObject({ permission: "WITHOUT_PERMISSION", proof: "BALANCE", recordedByName: "المشرف خالد", recordedById: data.members.find((m) => m.role === "SUPERVISOR")!.id });
    expect(report.skipped).toContainEqual({ table: "teacherAbsences", reason: "غياب بلا تاريخ", count: 1 });
    expect(report.skipped).toContainEqual({ table: "payrollRows", reason: "الموظف غير موجود", count: 1 });
  });

  it("converts fees, collections and exams", () => {
    const { data, report } = convert();
    expect(data.feeCategories.map((c) => [c.name, c.amount, c.defaultFor])).toEqual([["صغار", 50, "CHILD"], ["كبار", 80, "ADULT"]]);
    expect(data.feeDiscounts.map((d) => [d.name, d.type, d.value, d.perStudent])).toEqual([["أيتام", "PERCENT", 100, false], ["حالات خاصة", "AMOUNT", 0, true]]);
    expect(data.feePayments[0]).toMatchObject({ year: 2025, month: 1, amount: 40, date: "2025-01-10", collectedByName: "المحاسب سعيد" });
    expect(data.collections[0]).toMatchObject({ teacherId: TEACHER_UUID, status: "RETURNED", accountantNote: "راجع", sentAt: "2025-01-11T10:00:00.000Z", reviewedByName: "سعيد" });
    expect(data.collectionLines).toHaveLength(1);
    expect(data.collectionLines[0]).toMatchObject({ collectionId: data.collections[0].id, amount: 40, state: "ISSUE", accountantNote: "ناقص" });

    expect(data.examSettings).toMatchObject({ questionScore: 20, mistakePenalty: 2, promptPenalty: 0.5, excellentFrom: 95, passFrom: 50 });
    expect(data.competitionLevels[0]).toMatchObject({ competitionId: data.competitions[0].id, fromJuz: 1, toJuz: 5, questionCount: 3 });
    expect(data.exams).toHaveLength(1);
    expect(data.exams[0]).toMatchObject({
      type: "COMPETITION", competitionId: data.competitions[0].id, competitionName: "مسابقة رمضان", levelId: data.competitionLevels[0].id,
      levelName: "الأول", maxScore: 40, total: 36.5, examinerName: "المشرف خالد",
    });
    expect(data.examQuestions.map((q) => [q.position, q.surah, q.fromAyah, q.toAyah, q.mistakes, q.prompts, q.score])).toEqual([[0, 2, 1, 5, 1, 2, 17], [1, 3, 1, 1, 0, 0, 19.5]]);
    expect(report.skipped).toContainEqual({ table: "exams", reason: "نوع اختبار غير معروف", count: 1 });
    expect(report.counts.members).toBe(7);
  });

  it("falls back to the built-in discounts and to places written inside halaqat", () => {
    const doc = { ...legacyDoc(), places: undefined, halaqat: [{ id: "h1", place: "دار  السلام" }, { id: "h2", place: "دار السلام" }] };
    doc.settings = { ...doc.settings, priv_fees: undefined } as never;
    const { data } = convertLegacyBackup(doc, { today: "2025-06-01" });
    expect(data.places).toMatchObject([{ name: "دار السلام", type: "DAR" }]);
    expect(data.halaqat.every((h) => h.placeId === data.places[0].id)).toBe(true);
    expect(data.feeDiscounts.map((d) => d.name)).toEqual(["أبناء موظفي التحفيظ", "أبناء موظفي الجمعية", "أيتام", "حالات خاصة"]);
    // The student still points at «حالات خاصة» through its old built-in id.
    expect(data.studentProfiles.some((p) => p.feeDiscountId === data.feeDiscounts[3].id)).toBe(true);
  });
});

describe("normalizeBackup", () => {
  it("clears dangling optional references, drops orphans and resolves unique clashes", () => {
    const S = "11111111-1111-4111-8111-111111111111";
    const T = "22222222-2222-4222-8222-222222222222";
    const GHOST = "99999999-9999-4999-8999-999999999999";
    const raw = backupDataSchema.parse({
      members: [{ id: S, role: "STUDENT", name: "طالب" }, { id: T, role: "TEACHER", name: "معلم" }],
      places: [{ id: "33333333-3333-4333-8333-333333333333", name: "مسجد" }, { id: "44444444-4444-4444-8444-444444444444", name: "مسجد" }],
      halaqat: [{ id: "55555555-5555-4555-8555-555555555555", teacherId: GHOST, placeId: "33333333-3333-4333-8333-333333333333" }],
      studentProfiles: [{ memberId: T }],
      recitations: [{ id: "66666666-6666-4666-8666-666666666666", studentId: GHOST, date: "2025-01-01", type: "HIFZ", surah: 1, fromAyah: 1, toAyah: 2 }],
      feeCategories: [
        { id: "77777777-7777-4777-8777-777777777777", name: "أ", amount: 1, defaultFor: "CHILD" },
        { id: "88888888-8888-4888-8888-888888888888", name: "ب", amount: 2, defaultFor: "CHILD" },
      ],
    });
    const report = new ReportBuilder();
    const data = normalizeBackup(raw, report);
    expect(data.places.map((p) => p.name)).toEqual(["مسجد", "مسجد (2)"]);
    expect(data.halaqat[0]).toMatchObject({ teacherId: null, placeId: "33333333-3333-4333-8333-333333333333" });
    expect(data.recitations).toEqual([]);
    expect(data.feeCategories.map((c) => c.defaultFor)).toEqual(["CHILD", null]);
    // The profile attached to a teacher is dropped; defaults are created for both accounts.
    expect(data.studentProfiles.map((p) => p.memberId)).toEqual([S]);
    expect(data.teacherProfiles.map((p) => p.memberId)).toEqual([T]);
    expect(report.skipped).toContainEqual({ table: "recitations", reason: "الطالب غير موجود", count: 1 });
    expect(normalizeBackup(emptyBackupData(), new ReportBuilder())).toEqual(emptyBackupData());
  });
});
