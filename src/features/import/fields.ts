/**
 * The system fields a spreadsheet column can be matched to («نظير»).
 * Target ids keep the legacy vocabulary so mappings stay readable:
 *   core:phone | core:pin | core:halaqa   account-level values
 *   info:<key>                            student application form (StudentProfile)
 *   prof:<group>:<key>                    teacher file (TeacherProfile)
 *   extra:<key>                           admin-defined custom field (Member.extra)
 */
import { normalizeArabic } from "@/lib/arabic";

export type ImportKind = "STUDENTS" | "TEACHERS";

export const KIND_ROLE = { STUDENTS: "STUDENT", TEACHERS: "TEACHER" } as const;
export const KIND_LABELS: Record<ImportKind, string> = { STUDENTS: "الطلاب", TEACHERS: "المعلمون" };
export const KIND_ONE: Record<ImportKind, string> = { STUDENTS: "طالب", TEACHERS: "معلم" };

export const FIELD_TYPE_LABELS = { TEXT: "نص", NUMBER: "رقم", DATE: "تاريخ", TEXTAREA: "نص طويل" } as const;
export type FieldType = keyof typeof FIELD_TYPE_LABELS;
export const FIELD_TYPES = Object.keys(FIELD_TYPE_LABELS) as FieldType[];

export interface FieldTarget {
  id: string;
  label: string;
  /** Other header spellings that mean the same field. */
  synonyms: readonly string[];
}

/** Header spellings of the built-in columns. */
export const HEADER_SYNONYMS = {
  name: ["الاسم", "اسم", "اسم الطالب", "اسم المعلم", "name", "full name"],
  halaqa: ["الحلقة", "حلقة", "حلقة المعلم", "المعلم", "halaqa", "group", "class"],
  phone: ["الجوال", "جوال", "رقم الجوال", "الهاتف", "هاتف", "رقم الهاتف", "phone", "mobile", "tel"],
  pin: ["كلمة المرور", "الرمز", "الرمز السري", "pin", "password"],
} as const;

export type ValueType = "text" | "phone" | "date" | "int" | "money" | "teacherStatus";

interface ColumnTarget extends FieldTarget {
  scope: "student" | "teacher";
  /** Column of StudentProfile / TeacherProfile. */
  column: string;
  type: ValueType;
}

const student = (key: string, label: string, column: string, synonyms: string[], type: ValueType = "text"): ColumnTarget => ({
  id: `info:${key}`, label, synonyms, scope: "student", column, type,
});

export const STUDENT_COLUMN_TARGETS: readonly ColumnTarget[] = [
  student("address", "العنوان", "address", ["السكن"]),
  student("birth", "تاريخ الميلاد", "birthDate", ["الميلاد"], "date"),
  student("study", "الدراسة", "study", ["نوع الدراسة"]),
  student("grade", "الصف الدراسي", "grade", ["الصف"]),
  student("whatsapp", "واتساب", "whatsapp", ["الواتساب", "رقم الواتساب", "whatsapp"], "phone"),
  student("gName", "اسم ولي الأمر", "guardianName", ["ولي الأمر"]),
  student("gJob", "وظيفة ولي الأمر", "guardianJob", []),
  student("job", "الوظيفة", "job", ["الوظيفة الحالية"]),
  student("qual", "المؤهل الدراسي", "qualification", ["المؤهل"]),
];

const teacher = (
  group: "personal" | "admin" | "tech",
  key: string,
  label: string,
  column: string,
  synonyms: string[] = [],
  type: ValueType = "text",
): ColumnTarget => ({
  id: `prof:${group}:${key}`,
  label,
  // The label without its parenthesised hint is a synonym too: «الأجزاء المحفوظة (0–30)».
  synonyms: [label.replace(/\s*\(.*\)\s*/, ""), ...synonyms],
  scope: "teacher",
  column,
  type,
});

export const TEACHER_COLUMN_TARGETS: readonly ColumnTarget[] = [
  teacher("personal", "fullName", "الاسم الكامل", "fullName", ["الاسم الرباعي"]),
  teacher("personal", "birth", "تاريخ الميلاد", "birthDate", ["الميلاد", "تاريخ الولادة"], "date"),
  teacher("personal", "email", "البريد الإلكتروني", "email", ["البريد", "الايميل", "email"]),
  teacher("personal", "address", "العنوان", "address", ["السكن"]),
  teacher("personal", "emergency", "جهة اتصال للطوارئ (الاسم والرقم)", "emergencyContact", ["الطوارئ"]),
  teacher("admin", "empNo", "الرقم الوظيفي", "employeeNo"),
  teacher("admin", "joinDate", "تاريخ الالتحاق", "joinDate", [], "date"),
  teacher("admin", "contract", "نوع التعاقد", "contractType", ["التعاقد"]),
  teacher("admin", "status", "الحالة", "status", [], "teacherStatus"),
  teacher("admin", "pay", "المكافأة الشهرية", "monthlyPay", ["المكافأة"], "money"),
  teacher("admin", "adminNote", "ملاحظات إدارية", "adminNote"),
  teacher("tech", "qual", "المؤهل العلمي", "qualification", ["المؤهل"]),
  teacher("tech", "riwaya", "الرواية", "riwaya", ["رواية"]),
  teacher("tech", "ijaza", "الإجازة", "ijaza"),
  teacher("tech", "sanad", "اسم الشيخ المُجيز / السند", "sanad", ["السند", "الشيخ المجيز"]),
  teacher("tech", "memorized", "الأجزاء المحفوظة (0–30)", "memorizedParts", ["الأجزاء", "عدد الأجزاء", "المحفوظ"], "int"),
  teacher("tech", "exp", "سنوات الخبرة في التحفيظ", "experienceYears", ["الخبرة"], "int"),
  teacher("tech", "specialty", "التخصصات (تلقين، تجويد، مراجعة…)", "specialty", ["التخصص"]),
  teacher("tech", "courses", "الدورات والشهادات", "courses", ["الدورات"]),
];

export function columnTarget(id: string): ColumnTarget | undefined {
  return STUDENT_COLUMN_TARGETS.find((t) => t.id === id) ?? TEACHER_COLUMN_TARGETS.find((t) => t.id === id);
}

export const TARGET_PHONE = "core:phone";
export const TARGET_PIN = "core:pin";
export const TARGET_HALAQA = "core:halaqa";
export const EXTRA_PREFIX = "extra:";

/** Every field a column of this kind of file can be matched to, custom fields last. */
export function fieldTargets(kind: ImportKind, customFields: ReadonlyArray<{ key: string; label: string }>): FieldTarget[] {
  const list: FieldTarget[] = [
    { id: TARGET_PHONE, label: kind === "STUDENTS" ? "جوال ولي الأمر" : "الجوال", synonyms: HEADER_SYNONYMS.phone },
    { id: TARGET_PIN, label: "كلمة المرور", synonyms: HEADER_SYNONYMS.pin },
  ];
  if (kind === "STUDENTS") {
    list.push({ id: TARGET_HALAQA, label: "الحلقة", synonyms: HEADER_SYNONYMS.halaqa }, ...STUDENT_COLUMN_TARGETS);
  } else {
    list.push(...TEACHER_COLUMN_TARGETS);
  }
  for (const f of customFields) list.push({ id: EXTRA_PREFIX + f.key, label: f.label, synonyms: [] });
  return list.map(({ id, label, synonyms }) => ({ id, label, synonyms }));
}

/** Comparison key for headers: Arabic-normalised, without spaces and punctuation. */
export function headerKey(text: string | null | undefined): string {
  return normalizeArabic(text).replace(/[\s_\-:.]/g, "");
}

export const isNameHeader = (header: string) => HEADER_SYNONYMS.name.some((x) => headerKey(x) === headerKey(header));

/** The target whose label or a synonym equals this header, if any. */
export function matchHeader(header: string, targets: readonly FieldTarget[]): FieldTarget | undefined {
  const key = headerKey(header);
  if (!key) return undefined;
  return targets.find((t) => [t.label, ...t.synonyms].some((s) => headerKey(s) === key));
}
