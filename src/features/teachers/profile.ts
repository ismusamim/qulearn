import { normalizeArabic } from "@/lib/arabic";

/**
 * The teacher's internal file («ملف المعلم الداخلي»): its three sections, the
 * fields of each and their fixed option lists. Pure data and helpers, shared
 * by the forms (client) and the service (server).
 */

export type TeacherStatus = "ACTIVE" | "ON_LEAVE" | "SUSPENDED";
export const TEACHER_STATUSES: readonly TeacherStatus[] = ["ACTIVE", "ON_LEAVE", "SUSPENDED"];

/** The administration speaks of a teacher as «عامل» or «متوقف» rather than نشط / موقوف. */
export const WORK_STATUS_LABELS: Record<TeacherStatus, string> = {
  ACTIVE: "عامل",
  ON_LEAVE: "في إجازة",
  SUSPENDED: "متوقف",
};

export const CONTRACT_TYPES = ["متطوع", "متعاقد", "موظف"] as const;
export const RIWAYAT = ["حفص عن عاصم", "ورش عن نافع", "قالون عن نافع", "غير ذلك"] as const;
export const IJAZAT = ["بدون إجازة", "إجازة في القراءة", "إجازة في الرواية", "إجازة بالسند المتصل"] as const;

export type SectionKey = "personal" | "administrative" | "technical";

export interface ProfileField {
  name: string;
  label: string;
  type?: "text" | "date" | "tel" | "email" | "number" | "textarea" | "select";
  options?: readonly { value: string; label: string }[];
}

const options = (values: readonly string[]) => values.map((value) => ({ value, label: value }));

export const PROFILE_SECTIONS: Record<SectionKey, { label: string; title: string; fields: readonly ProfileField[] }> = {
  personal: {
    label: "بيانات شخصية",
    title: "البيانات الشخصية",
    fields: [
      { name: "fullName", label: "الاسم الكامل" },
      { name: "birthDate", label: "تاريخ الميلاد", type: "date" },
      { name: "phone", label: "الجوال", type: "tel" },
      { name: "email", label: "البريد الإلكتروني", type: "email" },
      { name: "address", label: "العنوان" },
      { name: "emergencyContact", label: "جهة اتصال للطوارئ (الاسم والرقم)" },
    ],
  },
  administrative: {
    label: "بيانات إدارية",
    title: "البيانات الإدارية",
    fields: [
      { name: "employeeNo", label: "الرقم الوظيفي" },
      { name: "joinDate", label: "تاريخ الالتحاق", type: "date" },
      { name: "contractType", label: "نوع التعاقد", type: "select", options: options(CONTRACT_TYPES) },
      {
        name: "status",
        label: "الحالة",
        type: "select",
        options: TEACHER_STATUSES.map((value) => ({ value, label: WORK_STATUS_LABELS[value] })),
      },
      { name: "monthlyPay", label: "المكافأة الشهرية", type: "number" },
      { name: "adminNote", label: "ملاحظات إدارية", type: "textarea" },
    ],
  },
  technical: {
    label: "بيانات فنية",
    title: "البيانات الفنية",
    fields: [
      { name: "qualification", label: "المؤهل العلمي" },
      { name: "riwaya", label: "الرواية", type: "select", options: options(RIWAYAT) },
      { name: "ijaza", label: "الإجازة", type: "select", options: options(IJAZAT) },
      { name: "sanad", label: "اسم الشيخ المُجيز / السند" },
      { name: "memorizedParts", label: "الأجزاء المحفوظة (0–30)", type: "number" },
      { name: "experienceYears", label: "سنوات الخبرة في التحفيظ", type: "number" },
      { name: "specialty", label: "التخصصات (تلقين، تجويد، مراجعة…)" },
      { name: "courses", label: "الدورات والشهادات", type: "textarea" },
    ],
  },
};

export interface CustomFieldLike {
  key: string;
}

/** Member.extra is JSON; only string values keyed by custom-field key are meaningful. */
export function readExtra(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, v] of Object.entries(value)) {
    if (typeof v === "string") out[key] = v;
    else if (typeof v === "number") out[key] = String(v);
  }
  return out;
}

/**
 * New value of Member.extra after an edit: only keys of fields the admin has
 * defined are accepted from the form; everything already stored is kept.
 */
export function mergeExtra(
  existing: unknown,
  submitted: Record<string, string>,
  fields: readonly CustomFieldLike[],
): Record<string, string> {
  const out = readExtra(existing);
  for (const { key } of fields) {
    if (Object.hasOwn(submitted, key)) out[key] = String(submitted[key] ?? "").trim();
  }
  return out;
}

/** Client-side search over the teachers list: Arabic-insensitive name match, or part of the phone. */
export function filterTeachers<T extends { name: string; phone: string }>(rows: readonly T[], query: string): T[] {
  const q = normalizeArabic(query);
  if (!q) return [...rows];
  const digits = q.replace(/\D/g, "");
  return rows.filter(
    (row) => normalizeArabic(row.name).includes(q) || (digits.length > 0 && digits === q && row.phone.includes(digits)),
  );
}
