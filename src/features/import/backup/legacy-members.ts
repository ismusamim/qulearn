/**
 * Accounts of the old app → members + profiles.
 * Old shape: five collections (admins, supervisors, teachers, accountants,
 * students) of { id, name, phone, pin, extra, photo }. Students add halaqaId,
 * cat and the application form in `info`; teachers add their file in
 * `personal` / `admin` / `tech`.
 */
import { fixName, normalizeArabic, normalizePhone } from "@/lib/arabic";

import { defaultStudentProfile, defaultTeacherProfile } from "./integrity";
import type { LegacyContext } from "./legacy-context";
import * as v from "./legacy-values";

const COLLECTIONS = [
  ["admins", "ADMIN", "المديرون"],
  ["supervisors", "SUPERVISOR", "المشرفون"],
  ["teachers", "TEACHER", "المعلمون"],
  ["accountants", "ACCOUNTANT", "المحاسبون"],
  ["students", "STUDENT", "الطلاب"],
] as const;

function extraValues(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(v.obj(raw))) {
    const text = v.str(value);
    if (text) out[key] = text;
  }
  return out;
}

/** Registers every account first, so later references (halaqa → teacher…) resolve whatever the order. */
export function convertMembers(ctx: LegacyContext, db: v.Loose): void {
  let withoutPassword = 0;
  for (const [collection, role, label] of COLLECTIONS) {
    const seenNames = new Map<string, number>();
    v.arr(db[collection]).forEach((m, index) => {
      const name = fixName(v.str(m.name));
      if (!name) return ctx.report.skip("members", "حساب بلا اسم");
      const id = ctx.ids.assign(collection, m.id, `#${index}`);
      const photo = v.str(m.photo);
      const added = ctx.add("members", {
        id,
        role,
        name,
        phone: normalizePhone(v.str(m.phone)),
        passwordHash: null,
        photo: photo.startsWith("data:image/") ? photo : null,
        extra: extraValues(m.extra),
      });
      if (!added) return;
      const key = normalizeArabic(name);
      seenNames.set(key, (seenNames.get(key) ?? 0) + 1);
      const pin = v.str(m.pin).trim();
      if (pin) ctx.pins[id] = pin;
      else withoutPassword++;
    });
    const repeated = [...seenNames.values()].filter((n) => n > 1).length;
    if (repeated) ctx.report.note(`${repeated} اسمًا مكررًا في «${label}» — راجعها بعد الاستيراد (الاسم لا يتكرر في الفئة نفسها)`);
  }
  if (withoutPassword) {
    ctx.report.note(`${withoutPassword} حسابًا بلا كلمة مرور في الملف — أنشئ لها كلمات مرور من «الأعضاء» بعد الاستيراد`);
  }
}

/** Old fee references: `info.feeCat` / `info.feeDisc` hold ids of settings.priv_fees entries. */
export function convertStudentProfiles(ctx: LegacyContext, db: v.Loose): void {
  for (const s of v.arr(db.students)) {
    const memberId = ctx.ids.get("students", s.id);
    if (!memberId || !ctx.data.members.some((m) => m.id === memberId)) continue;
    const info = v.obj(s.info);
    const test = v.obj(info.test);
    const discountValue = v.num(info.feeDiscVal);
    const fee = v.num(info.fee);
    const nationalId = v.str(info.nid).replace(/\D/g, "");
    ctx.add("studentProfiles", {
      ...defaultStudentProfile(memberId),
      category: s.cat === "adult" ? "ADULT" : "CHILD",
      halaqaId: ctx.ids.get("halaqat", s.halaqaId),
      status: info.status === "منقطع" ? "DROPPED" : "ACTIVE",
      statusDate: v.date(info.statusDate),
      nationalId: nationalId || null,
      birthDate: v.date(info.birth),
      birthYear: v.int(info.birthYear),
      address: v.str(info.address),
      phone: normalizePhone(v.str(info.phone)),
      whatsapp: normalizePhone(v.str(info.whatsapp)),
      study: v.str(info.study),
      grade: v.str(info.grade),
      guardianName: v.str(info.gName),
      guardianJob: v.str(info.gJob),
      guardianPhone: normalizePhone(v.str(info.gPhone)),
      guardianWhatsapp: normalizePhone(v.str(info.gWhatsapp)),
      guardianRelation: v.str(info.gRel),
      guardianRelationOther: v.str(info.gRelOther),
      maritalStatus: v.str(info.marital),
      qualification: v.str(info.qual),
      qualificationStatus: v.str(info.qualStatus),
      job: v.str(info.job),
      availability: v.str(info.avail),
      testReading: v.str(test.read),
      testTajweed: v.str(test.tajweed),
      testHifz: v.str(test.hifz),
      joinDate: v.date(info.joinDate),
      pledgeSigned: info.pledge === true,
      monthlyFee: fee != null && fee > 0 ? fee : null,
      feeCategoryId: ctx.ids.get("feeCategories", info.feeCat),
      feeDiscountId: ctx.ids.get("feeDiscounts", info.feeDisc),
      feeDiscountValue: discountValue,
      feeDiscountType: discountValue != null ? v.discountType(info.feeDiscType) : null,
    });
  }
}

export function convertTeacherProfiles(ctx: LegacyContext, db: v.Loose): void {
  for (const t of v.arr(db.teachers)) {
    const memberId = ctx.ids.get("teachers", t.id);
    if (!memberId || !ctx.data.members.some((m) => m.id === memberId)) continue;
    const personal = v.obj(t.personal);
    const admin = v.obj(t.admin);
    const tech = v.obj(t.tech);
    ctx.add("teacherProfiles", {
      ...defaultTeacherProfile(memberId),
      fullName: v.str(personal.fullName),
      birthDate: v.date(personal.birth),
      email: v.str(personal.email),
      address: v.str(personal.address),
      emergencyContact: v.str(personal.emergency),
      employeeNo: v.str(admin.empNo),
      joinDate: v.date(admin.joinDate),
      contractType: v.str(admin.contract),
      status: v.teacherStatus(admin.status),
      monthlyPay: v.num(admin.pay),
      adminNote: v.str(admin.adminNote),
      qualification: v.str(tech.qual),
      riwaya: v.str(tech.riwaya),
      ijaza: v.str(tech.ijaza),
      sanad: v.str(tech.sanad),
      memorizedParts: v.int(tech.memorized),
      experienceYears: v.int(tech.exp),
      specialty: v.str(tech.specialty),
      courses: v.str(tech.courses),
    });
  }
}
