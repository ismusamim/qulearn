/**
 * Converts a backup of the old app (its exported JSON / localStorage object)
 * into the qulearn backup format. Pure: no database, no hashing — plain
 * passwords are returned separately for the server to hash.
 *
 * Old document: { settings, admins, supervisors, teachers, accountants, students, places, halaqat,
 *   attendance, records, news, fields, pending, payroll, fees, collections, exams }.
 * Ids that are already UUIDs are preserved; others get a stable derived UUID,
 * applied consistently to every reference.
 */
import { isPermissionKey } from "@/lib/permissions";

import { type BackupData, countTables } from "./format";
import { normalizeBackup } from "./integrity";
import { LegacyContext, MEMBER_SCOPES } from "./legacy-context";
import { convertCollections, convertExams, convertFeeConfig, convertFees, convertPayroll } from "./legacy-finance";
import { convertMembers, convertStudentProfiles, convertTeacherProfiles } from "./legacy-members";
import * as v from "./legacy-values";
import type { BackupReport } from "./report";

export interface LegacyConversion {
  data: BackupData;
  /** Plain passwords by member id (old `pin`), to be hashed on import. */
  pins: Record<string, string>;
  /** The extra PIN that protected the payroll section, if any. */
  payrollPin: string | null;
  report: BackupReport;
}

const REQUIRED_LISTS = ["teachers", "halaqat", "students", "attendance", "records", "news"] as const;

/** Same test the old app applied to a pasted backup. */
export function isLegacyBackup(raw: unknown): raw is v.Loose {
  const d = v.obj(raw);
  return !!d.settings && typeof d.settings === "object" && REQUIRED_LISTS.every((k) => Array.isArray(d[k]));
}

function convertPlacesAndHalaqat(ctx: LegacyContext, db: v.Loose): void {
  v.arr(db.places).forEach((p, i) => {
    ctx.add("places", {
      id: ctx.ids.assign("places", p.id, `#${i}`),
      name: v.str(p.name).replace(/\s+/g, " ").trim(),
      type: v.placeType(p.type),
      address: v.str(p.address),
    });
  });
  // The oldest data kept the place as free text inside each halaqa.
  const textPlaces = new Map<string, string>();
  const placeFromText = (text: unknown): string | null => {
    const name = v.str(text).replace(/\s+/g, " ").trim();
    if (!name || Array.isArray(db.places)) return null;
    let id = textPlaces.get(name);
    if (!id) {
      id = ctx.ids.assign("places", null, `name:${name}`);
      ctx.add("places", { id, name, type: /دار/.test(name) ? "DAR" : "MOSQUE", address: "" });
      textPlaces.set(name, id);
    }
    return id;
  };

  v.arr(db.halaqat).forEach((h, i) => {
    ctx.add("halaqat", {
      id: ctx.ids.assign("halaqat", h.id, `#${i}`),
      name: v.str(h.name),
      teacherId: ctx.ids.get("teachers", h.teacherId),
      supervisorId: ctx.ids.get("supervisors", h.supervisorId),
      placeId: ctx.ids.get("places", h.placeId) ?? placeFromText(h.place),
      ...v.schedule(h.time, h.schedule),
    });
  });
}

function convertDailyRecords(ctx: LegacyContext, db: v.Loose): void {
  v.arr(db.attendance).forEach((a, i) => {
    const studentId = ctx.ids.get("students", a.studentId);
    if (!studentId) return ctx.report.skip("attendance", "الطالب غير موجود");
    const status = v.attendanceStatus(a.status);
    if (!status) return ctx.report.skip("attendance", "حالة حضور غير معروفة");
    ctx.add("attendance", { id: ctx.ids.assign("attendance", a.id, `#${i}`), studentId, date: v.date(a.date), status });
  });

  v.arr(db.records).forEach((r, i) => {
    const studentId = ctx.ids.get("students", r.studentId);
    if (!studentId) return ctx.report.skip("recitations", "الطالب غير موجود");
    const type = v.recitationType(r.type);
    if (!type) return ctx.report.skip("recitations", "نوع تسميع غير معروف");
    ctx.add("recitations", {
      id: ctx.ids.assign("records", r.id, `#${i}`),
      studentId,
      date: v.date(r.date),
      type,
      surah: v.int(r.surah),
      fromAyah: v.int(r.from),
      toAyah: v.int(r.to) ?? v.int(r.from),
      grade: v.strOrNull(r.grade),
      note: v.str(r.note),
    });
  });

  // News keep their order: the old app showed the list reversed, the new one sorts by createdAt.
  const base = Date.parse(`${ctx.today}T00:00:00Z`) - v.arr(db.news).length * 1000;
  v.arr(db.news).forEach((n, i) => {
    const text = v.str(n.text).trim();
    if (!text) return ctx.report.skip("news", "إعلان بلا نص");
    ctx.add("news", {
      id: ctx.ids.assign("news", n.id, `#${i}`),
      text,
      audience: v.newsAudience(n.audience),
      date: v.date(n.date) ?? ctx.today,
      authorId: ctx.ids.find(MEMBER_SCOPES, n.authorId),
      authorLabel: v.strOrNull(n.author),
      createdAt: new Date(base + i * 1000).toISOString(),
    });
  });
}

function convertFieldsAndPending(ctx: LegacyContext, db: v.Loose): void {
  const fields = v.obj(db.fields);
  for (const kind of ["students", "teachers"] as const) {
    for (const f of v.arr(fields[kind])) {
      ctx.add("customFields", { kind: v.fieldKind(kind), key: v.str(f.key), label: v.str(f.label), type: v.fieldType(f.type) });
    }
  }
  const names = new Map(ctx.data.members.map((m) => [m.id, m.name]));
  v.arr(db.pending).forEach((p, i) => {
    const kind = v.fieldKind(p.kind);
    if (!kind) return ctx.report.skip("pendingColumns", "نوع غير معروف");
    const scope = kind === "STUDENTS" ? "students" : "teachers";
    const values = v.arr(p.values).flatMap((x) => {
      const memberId = ctx.ids.get(scope, x.mid);
      const value = v.str(x.v);
      return memberId && value ? [{ memberId, name: names.get(memberId) ?? "", value }] : [];
    });
    ctx.add("pendingColumns", {
      id: ctx.ids.assign("pending", p.id, `#${i}`),
      kind,
      header: v.str(p.header),
      values,
      date: v.date(p.date) ?? ctx.today,
    });
  });
}

/**
 * settings.org / logo / theme / block_msgs → settings rows;
 * settings.priv_perms { roles: { teacher: { key: bool } }, members: { id: { key: bool } } } → permission tables.
 */
function convertSettings(ctx: LegacyContext, settings: v.Loose): void {
  const org = v.str(settings.org).trim();
  if (org) ctx.add("settings", { key: "org", value: org });
  const logo = v.str(settings.logo);
  if (logo.startsWith("data:image/")) ctx.add("settings", { key: "logo", value: logo });
  const theme = v.theme(settings.theme);
  if (Object.keys(theme).length) ctx.add("settings", { key: "theme", value: theme });
  const block = v.obj(settings.block_msgs);
  const blockMessages = Object.fromEntries(
    (["student", "teacher"] as const).flatMap((k) => (v.str(block[k]).trim() ? [[k, v.str(block[k])]] : [])),
  );
  if (Object.keys(blockMessages).length) ctx.add("settings", { key: "blockMessages", value: blockMessages });
  if (Object.keys(v.obj(settings.col_labels)).length) {
    ctx.report.note("أسماء الأعمدة المخصصة في الجداول (col_labels) لا مقابل لها في النظام الجديد فلم تُستورد");
  }

  const perms = v.obj(settings.priv_perms);
  const ROLES = { teacher: "TEACHER", supervisor: "SUPERVISOR", accountant: "ACCOUNTANT" } as const;
  for (const [oldRole, role] of Object.entries(ROLES)) {
    for (const [permission, allowed] of Object.entries(v.obj(v.obj(perms.roles)[oldRole]))) {
      if (isPermissionKey(permission)) ctx.add("rolePermissions", { role, permission, allowed: !!allowed });
    }
  }
  for (const [oldId, overrides] of Object.entries(v.obj(perms.members))) {
    const memberId = ctx.ids.find(MEMBER_SCOPES, oldId);
    if (!memberId) {
      ctx.report.skip("memberPermissions", "العضو غير موجود", Object.keys(v.obj(overrides)).length);
      continue;
    }
    for (const [permission, allowed] of Object.entries(v.obj(overrides))) {
      if (isPermissionKey(permission)) ctx.add("memberPermissions", { memberId, permission, allowed: !!allowed });
    }
  }
}

export function convertLegacyBackup(raw: unknown, options: { today: string }): LegacyConversion {
  if (!isLegacyBackup(raw)) throw new Error("not-legacy");
  const ctx = new LegacyContext(options.today);
  const settings = v.obj(raw.settings);

  convertMembers(ctx, raw);
  convertFeeConfig(ctx, settings);
  convertPlacesAndHalaqat(ctx, raw);
  convertStudentProfiles(ctx, raw);
  convertTeacherProfiles(ctx, raw);
  convertDailyRecords(ctx, raw);
  convertFieldsAndPending(ctx, raw);
  convertSettings(ctx, settings);
  convertPayroll(ctx, raw);
  convertFees(ctx, raw);
  convertCollections(ctx, raw);
  convertExams(ctx, raw, settings);

  const data = normalizeBackup(ctx.data, ctx.report);
  return {
    data,
    pins: ctx.pins,
    payrollPin: ctx.payrollPin,
    report: { counts: countTables(data), skipped: ctx.report.skipped, notes: ctx.report.notes },
  };
}
