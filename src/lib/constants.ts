/**
 * Arabic labels for enum values and fixed option lists.
 * Enum string unions are declared here (not imported from Prisma) so client
 * components can use them without pulling in the database client.
 */

export type Role = "ADMIN" | "SUPERVISOR" | "TEACHER" | "STUDENT" | "ACCOUNTANT";

export const ROLES: readonly Role[] = ["TEACHER", "STUDENT", "SUPERVISOR", "ACCOUNTANT", "ADMIN"];

export const ROLE_LABELS: Record<Role, string> = {
  STUDENT: "طالب",
  TEACHER: "معلم",
  SUPERVISOR: "مشرف",
  ACCOUNTANT: "محاسب",
  ADMIN: "مدير",
};

export const ROLE_PLURAL_LABELS: Record<Role, string> = {
  STUDENT: "الطلاب",
  TEACHER: "المعلمون",
  SUPERVISOR: "المشرفون",
  ACCOUNTANT: "المحاسبون",
  ADMIN: "المديرون",
};

export const PLACE_TYPE_LABELS = { MOSQUE: "مسجد", DAR: "دار تحفيظ" } as const;

export const PRAYERS = ["الفجر", "الظهر", "العصر", "المغرب", "العشاء"] as const;

export const ATTENDANCE_LABELS = {
  PRESENT: "حاضر",
  LATE: "متأخر",
  EXCUSED: "معتذر",
  ABSENT: "غائب",
} as const;

export const RECITATION_TYPE_LABELS = {
  HIFZ: "حفظ",
  REVIEW: "مراجعة",
  CONSOLIDATION: "تثبيت",
} as const;

export const GRADES = ["ممتاز", "جيد جدًا", "جيد", "مقبول", "يعاد"] as const;

export const STUDENT_CATEGORY_LABELS = { CHILD: "صغير", ADULT: "كبير" } as const;
export const STUDENT_STATUS_LABELS = { ACTIVE: "منتظم", DROPPED: "منقطع" } as const;
export const TEACHER_STATUS_LABELS = { ACTIVE: "نشط", ON_LEAVE: "في إجازة", SUSPENDED: "موقوف" } as const;
export const EMPLOYEE_STATUS_LABELS = { ACTIVE: "نشط", STOPPED: "متوقف" } as const;

export const STUDY_TYPES = ["عام", "أزهر"] as const;
export const GUARDIAN_RELATIONS = ["الأب", "الأم", "شخص آخر"] as const;
export const MARITAL_STATUSES = ["أعزب", "متزوج"] as const;
export const QUALIFICATION_STATUSES = ["طالب", "خريج"] as const;

export const NEWS_AUDIENCE_LABELS = {
  ALL: "الجميع",
  ADMIN: "المديرون",
  SUPERVISOR: "المشرفون",
  TEACHER: "المعلمون",
  STUDENT: "الطلاب",
  ACCOUNTANT: "المحاسبون",
} as const;

export const DEFAULT_ORG_NAME = "إدارة الحلقات القرآنية";
export const CURRENCY_LABEL = "جنيه";
