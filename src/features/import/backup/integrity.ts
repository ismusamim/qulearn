/**
 * Makes a backup data set safe to insert: every reference points at a row
 * that exists in the same data set, and no unique constraint is violated.
 * Optional references that dangle are cleared; rows whose required parent is
 * missing are dropped and reported. Later duplicates win (the same rule the
 * old app used when two devices wrote the same natural key).
 */
import type { BackupData } from "./format";
import type { ReportBuilder } from "./report";

type Table = keyof BackupData;

function dedupe<T>(rows: T[], key: (row: T) => string, table: Table, reason: string, report: ReportBuilder): T[] {
  const last = new Map<string, T>();
  for (const row of rows) last.set(key(row), row);
  report.skip(table, reason, rows.length - last.size);
  return last.size === rows.length ? rows : [...last.values()];
}

function requireParent<T>(rows: T[], ok: (row: T) => boolean, table: Table, reason: string, report: ReportBuilder): T[] {
  const kept = rows.filter(ok);
  report.skip(table, reason, rows.length - kept.length);
  return kept;
}

/** Clears an optional reference when its target is missing. */
const ref = (value: string | null, ids: ReadonlySet<string>): string | null => (value && ids.has(value) ? value : null);

const byId = <T extends { id: string }>(rows: T[], table: Table, report: ReportBuilder) =>
  dedupe(rows, (r) => r.id, table, "معرّف مكرر", report);

const idSet = (rows: ReadonlyArray<{ id: string }>) => new Set(rows.map((r) => r.id));

export function normalizeBackup(input: BackupData, report: ReportBuilder): BackupData {
  const d: BackupData = { ...input };

  d.settings = dedupe(d.settings, (s) => s.key, "settings", "مفتاح مكرر", report).filter((s) => s.value != null);
  d.members = byId(d.members, "members", report);
  const members = new Map(d.members.map((m) => [m.id, m]));
  const memberIds = new Set(members.keys());
  const isStudent = (id: string) => members.get(id)?.role === "STUDENT";

  // Place names are unique in the database: a repeated name gets a numeric suffix.
  d.places = byId(d.places, "places", report);
  const placeNames = new Set<string>();
  d.places = d.places.map((p) => {
    let name = p.name;
    for (let n = 2; placeNames.has(name); n++) name = `${p.name} (${n})`;
    placeNames.add(name);
    return name === p.name ? p : { ...p, name };
  });
  const placeIds = idSet(d.places);

  d.halaqat = byId(d.halaqat, "halaqat", report).map((h) => ({
    ...h,
    teacherId: ref(h.teacherId, memberIds),
    supervisorId: ref(h.supervisorId, memberIds),
    placeId: ref(h.placeId, placeIds),
  }));
  const halaqaIds = idSet(d.halaqat);

  d.feeCategories = byId(d.feeCategories, "feeCategories", report);
  const defaults = new Set<string>();
  d.feeCategories = d.feeCategories.map((c) => {
    if (!c.defaultFor) return c;
    if (defaults.has(c.defaultFor)) return { ...c, defaultFor: null };
    defaults.add(c.defaultFor);
    return c;
  });
  d.feeDiscounts = byId(d.feeDiscounts, "feeDiscounts", report);
  const categoryIds = idSet(d.feeCategories);
  const discountIds = idSet(d.feeDiscounts);

  // Profiles: exactly one per student / teacher.
  const nationalIds = new Set<string>();
  d.studentProfiles = dedupe(
    requireParent(d.studentProfiles, (p) => isStudent(p.memberId), "studentProfiles", "ليست لطالب موجود", report),
    (p) => p.memberId, "studentProfiles", "استمارة مكررة", report,
  ).map((p) => {
    let nationalId = p.nationalId?.trim() || null;
    if (nationalId && nationalIds.has(nationalId)) {
      report.note(`رقم قومي مكرر (${nationalId}) أُبقي لأول طالب فقط`);
      nationalId = null;
    }
    if (nationalId) nationalIds.add(nationalId);
    return {
      ...p,
      nationalId,
      halaqaId: ref(p.halaqaId, halaqaIds),
      feeCategoryId: ref(p.feeCategoryId, categoryIds),
      feeDiscountId: ref(p.feeDiscountId, discountIds),
    };
  });
  d.teacherProfiles = dedupe(
    requireParent(d.teacherProfiles, (p) => members.get(p.memberId)?.role === "TEACHER", "teacherProfiles", "ليست لمعلم موجود", report),
    (p) => p.memberId, "teacherProfiles", "ملف مكرر", report,
  );

  d.rolePermissions = dedupe(d.rolePermissions, (p) => `${p.role}|${p.permission}`, "rolePermissions", "صلاحية مكررة", report);
  d.memberPermissions = dedupe(
    requireParent(d.memberPermissions, (p) => memberIds.has(p.memberId), "memberPermissions", "العضو غير موجود", report),
    (p) => `${p.memberId}|${p.permission}`, "memberPermissions", "صلاحية مكررة", report,
  );

  d.attendance = dedupe(
    requireParent(byId(d.attendance, "attendance", report), (a) => isStudent(a.studentId), "attendance", "الطالب غير موجود", report),
    (a) => `${a.studentId}|${a.date}`, "attendance", "تسجيل مكرر للطالب في اليوم نفسه", report,
  ).map((a) => ({ ...a, recordedById: ref(a.recordedById, memberIds) }));

  d.recitations = requireParent(byId(d.recitations, "recitations", report), (r) => isStudent(r.studentId), "recitations", "الطالب غير موجود", report)
    .map((r) => ({ ...r, recordedById: ref(r.recordedById, memberIds) }));

  d.news = byId(d.news, "news", report).map((n) => ({ ...n, authorId: ref(n.authorId, memberIds) }));
  d.customFields = dedupe(d.customFields, (f) => `${f.kind}|${f.key}`, "customFields", "حقل مكرر", report);
  d.pendingColumns = byId(d.pendingColumns, "pendingColumns", report);

  const linked = new Set<string>();
  d.employees = byId(d.employees, "employees", report).map((e) => {
    const memberId = ref(e.memberId, memberIds);
    if (memberId && linked.has(memberId)) return { ...e, memberId: null };
    if (memberId) linked.add(memberId);
    return { ...e, memberId };
  });
  const employeeIds = idSet(d.employees);

  d.payrollRows = dedupe(
    requireParent(byId(d.payrollRows, "payrollRows", report), (r) => employeeIds.has(r.employeeId), "payrollRows", "الموظف غير موجود", report),
    (r) => `${r.year}|${r.month}|${r.employeeId}`, "payrollRows", "صف مكرر للموظف في الشهر نفسه", report,
  );
  d.payrollClosedMonths = dedupe(d.payrollClosedMonths, (c) => `${c.year}|${c.month}`, "payrollClosedMonths", "شهر مكرر", report);
  d.teacherAbsences = dedupe(
    requireParent(byId(d.teacherAbsences, "teacherAbsences", report), (a) => employeeIds.has(a.employeeId), "teacherAbsences", "الموظف غير موجود", report),
    (a) => `${a.employeeId}|${a.date}`, "teacherAbsences", "غياب مكرر للموظف في اليوم نفسه", report,
  ).map((a) => ({ ...a, recordedById: ref(a.recordedById, memberIds) }));

  d.feePayments = requireParent(byId(d.feePayments, "feePayments", report), (f) => isStudent(f.studentId), "feePayments", "الطالب غير موجود", report)
    .map((f) => ({ ...f, collectedById: ref(f.collectedById, memberIds) }));

  d.collections = dedupe(
    requireParent(byId(d.collections, "collections", report), (c) => memberIds.has(c.teacherId), "collections", "المعلم غير موجود", report)
      .map((c) => ({ ...c, halaqaId: ref(c.halaqaId, halaqaIds) })),
    (c) => `${c.teacherId}|${c.halaqaId}|${c.year}|${c.month}`, "collections", "قائمة مكررة للحلقة في الشهر نفسه", report,
  );
  const collectionIds = idSet(d.collections);
  d.collectionLines = dedupe(
    requireParent(
      requireParent(byId(d.collectionLines, "collectionLines", report), (l) => collectionIds.has(l.collectionId), "collectionLines", "القائمة غير موجودة", report),
      (l) => isStudent(l.studentId), "collectionLines", "الطالب غير موجود", report,
    ),
    (l) => `${l.collectionId}|${l.studentId}`, "collectionLines", "سطر مكرر للطالب", report,
  );

  d.competitions = byId(d.competitions, "competitions", report);
  const competitionIds = idSet(d.competitions);
  d.competitionLevels = requireParent(byId(d.competitionLevels, "competitionLevels", report), (l) => competitionIds.has(l.competitionId), "competitionLevels", "المسابقة غير موجودة", report);
  const levelIds = idSet(d.competitionLevels);

  d.exams = requireParent(byId(d.exams, "exams", report), (e) => isStudent(e.studentId), "exams", "الطالب غير موجود", report).map((e) => ({
    ...e,
    halaqaId: ref(e.halaqaId, halaqaIds),
    examinerId: ref(e.examinerId, memberIds),
    competitionId: ref(e.competitionId, competitionIds),
    levelId: ref(e.levelId, levelIds),
  }));
  const examIds = idSet(d.exams);
  d.examQuestions = dedupe(
    requireParent(byId(d.examQuestions, "examQuestions", report), (q) => examIds.has(q.examId), "examQuestions", "الاختبار غير موجود", report),
    (q) => `${q.examId}|${q.position}`, "examQuestions", "سؤال مكرر", report,
  );

  // Every student and teacher needs a profile row for the rest of the app.
  const withStudentProfile = new Set(d.studentProfiles.map((p) => p.memberId));
  const withTeacherProfile = new Set(d.teacherProfiles.map((p) => p.memberId));
  const missingStudents = d.members.filter((m) => m.role === "STUDENT" && !withStudentProfile.has(m.id));
  const missingTeachers = d.members.filter((m) => m.role === "TEACHER" && !withTeacherProfile.has(m.id));
  if (missingStudents.length) d.studentProfiles = [...d.studentProfiles, ...missingStudents.map((m) => defaultStudentProfile(m.id))];
  if (missingTeachers.length) d.teacherProfiles = [...d.teacherProfiles, ...missingTeachers.map((m) => defaultTeacherProfile(m.id))];

  return d;
}

export function defaultStudentProfile(memberId: string): BackupData["studentProfiles"][number] {
  return {
    memberId, category: "CHILD", halaqaId: null, status: "ACTIVE", statusDate: null, nationalId: null, birthDate: null,
    birthYear: null, address: "", phone: "", whatsapp: "", study: "", grade: "", guardianName: "", guardianJob: "",
    guardianPhone: "", guardianWhatsapp: "", guardianRelation: "", guardianRelationOther: "", maritalStatus: "",
    qualification: "", qualificationStatus: "", job: "", availability: "", testReading: "", testTajweed: "", testHifz: "",
    joinDate: null, pledgeSigned: false, monthlyFee: null, feeCategoryId: null, feeDiscountId: null,
    feeDiscountValue: null, feeDiscountType: null,
  };
}

export function defaultTeacherProfile(memberId: string): BackupData["teacherProfiles"][number] {
  return {
    memberId, fullName: "", birthDate: null, email: "", address: "", emergencyContact: "", employeeNo: "", joinDate: null,
    contractType: "", status: "ACTIVE", monthlyPay: null, adminNote: "", qualification: "", riwaya: "", ijaza: "",
    sanad: "", memorizedParts: null, experienceYears: null, specialty: "", courses: "",
  };
}
