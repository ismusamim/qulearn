/** Fixed option lists and the layout of the monthly sheet. Client-safe (no server imports). */

export const JOB_TITLES = ["معلم", "معلم مجيز", "مساعد", "مشرف", "مشرف دار", "مشرف عام", "إداري"] as const;

export const WORK_SYSTEM_3 = "(3) أيام";
export const WORK_SYSTEM_6 = "(6) أيام";
export const WORK_SYSTEMS = [WORK_SYSTEM_3, WORK_SYSTEM_6] as const;

/** The monthly inputs of a payroll row, in sheet order. */
export const INPUT_KEYS = [
  "baseHours",
  "extraHours",
  "exceptionalHours",
  "absentWithPermission",
  "absentNoPermission",
  "meetingsWithPermission",
  "meetingsNoPermission",
  "deductionTest",
  "deductionRecitation",
  "deductionBooks",
  "basic",
  "rate",
  "incentive",
  "transport",
] as const;

export type InputKey = (typeof INPUT_KEYS)[number];

export type InputGroupKey = "hours" | "absence" | "deductions" | "salary";

export const INPUT_FIELDS: ReadonlyArray<{ key: InputKey; label: string; group: InputGroupKey }> = [
  { key: "baseHours", label: "أساسية", group: "hours" },
  { key: "extraHours", label: "إضافية", group: "hours" },
  { key: "exceptionalHours", label: "استثنائية", group: "hours" },
  { key: "absentWithPermission", label: "بإذن", group: "absence" },
  { key: "absentNoPermission", label: "بدون إذن", group: "absence" },
  { key: "meetingsWithPermission", label: "اجتماع بإذن", group: "absence" },
  { key: "meetingsNoPermission", label: "اجتماع بغير إذن", group: "absence" },
  { key: "deductionTest", label: "اختبار التطوير", group: "deductions" },
  { key: "deductionRecitation", label: "التسميع", group: "deductions" },
  { key: "deductionBooks", label: "الدفاتر", group: "deductions" },
  { key: "basic", label: "الأساسي", group: "salary" },
  { key: "rate", label: "سعر ساعة الإضافي", group: "salary" },
  { key: "incentive", label: "الحافز", group: "salary" },
  { key: "transport", label: "بدل الانتقال", group: "salary" },
];

export const INPUT_GROUPS: ReadonlyArray<{ key: InputGroupKey; label: string }> = [
  { key: "hours", label: "الساعات" },
  { key: "absence", label: "الغياب (ساعات / مرات)" },
  { key: "deductions", label: "خصومات" },
  { key: "salary", label: "عناصر الراتب" },
];

export const PAYROLL_TABS = [
  { key: "month", label: "كشف الشهر" },
  { key: "employees", label: "الموظفون" },
  { key: "year", label: "ملخص السنة" },
  { key: "archive", label: "الأرشيف" },
  { key: "leave", label: "الغياب والإجازات" },
  { key: "settings", label: "إعدادات المرتبات" },
] as const;

export type PayrollTab = (typeof PAYROLL_TABS)[number]["key"];

export function isPayrollTab(value: unknown): value is PayrollTab {
  return PAYROLL_TABS.some((t) => t.key === value);
}

/** The rule fields of the settings editor, with the legacy wording. */
export const RULE_FIELDS = [
  { key: "absenceWithPermission", label: "خصم ساعة الغياب بإذن" },
  { key: "absenceNoPermission", label: "خصم ساعة الغياب بدون إذن" },
  { key: "meetingWithPermission", label: "خصم غياب الاجتماع بإذن (للمرة)" },
  { key: "meetingNoPermission", label: "خصم غياب الاجتماع بغير إذن (للمرة)" },
  { key: "roundTo", label: "تقريب الراتب لأقرب" },
  { key: "leaveDays3", label: "رصيد إجازات نظام (3) أيام" },
  { key: "leaveDays6", label: "رصيد إجازات نظام (6) أيام" },
  { key: "defaultHours", label: "الساعات الأساسية الافتراضية" },
] as const;

export type RuleKey = (typeof RULE_FIELDS)[number]["key"];

/** Amounts are shown rounded, with a dash for zero / empty (as on the paper sheet). */
export function formatAmount(value: number | null | undefined): string {
  return value ? Math.round(value).toLocaleString("en-US") : "—";
}

/** «يناير (1)» — the sheets are numbered by month in the paper records. */
export function monthLabel(month: number, name: string): string {
  return `${name} (${month})`;
}

/** Hours keep their fractions (1.5 hours of absence must not read as 2). */
export function formatHours(value: number | null | undefined): string {
  return value ? (Math.round(value * 100) / 100).toLocaleString("en-US") : "—";
}
