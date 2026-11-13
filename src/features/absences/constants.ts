/** Fixed lists of the teacher-absence form. Client-safe. */

export const ABSENCE_REASONS = ["مرض", "امتحانات", "البلد", "سفر", "غير محدد"] as const;
/** Radio value that reveals a free-text reason. */
export const OTHER_REASON = "أخرى";
/** Select value that reveals a free-text place. */
export const OTHER_PLACE = "__other";

export type AbsencePermission = "WITH_PERMISSION" | "WITHOUT_PERMISSION";
export type AbsenceProof = "BALANCE" | "PROVEN";

export const PERMISSION_LABELS: Record<AbsencePermission, string> = {
  WITH_PERMISSION: "بإذن",
  WITHOUT_PERMISSION: "بغير إذن",
};

export const PROOF_LABELS: Record<AbsenceProof, string> = {
  BALANCE: "رصيد",
  PROVEN: "مثبت",
};
