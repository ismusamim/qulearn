/**
 * Pure rules of teacher collections (ported from the legacy save_collection /
 * review_collection database functions). No DB access here.
 */

export type CollectionStatus = "DRAFT" | "SENT" | "RETURNED" | "DONE";
export type LineState = "PENDING" | "OK" | "ISSUE";

export const COLLECTION_STATUS_LABELS: Record<CollectionStatus, string> = {
  DRAFT: "مسودة لم تُرسل",
  SENT: "بانتظار المحاسب",
  RETURNED: "مُعادة للتصحيح",
  DONE: "مؤكدة",
};

export const LINE_STATE_LABELS: Record<LineState, string> = {
  PENDING: "بانتظار المراجعة",
  OK: "مؤكد ✓",
  ISSUE: "مُعاد",
};

/** Filters of the accountant's list; drafts are never shown to reviewers. */
export const REVIEW_FILTERS = ["sent", "returned", "done", "all"] as const;
export type ReviewFilter = (typeof REVIEW_FILTERS)[number];
export const REVIEW_FILTER_LABELS: Record<ReviewFilter, string> = {
  sent: "بانتظار المراجعة",
  returned: "مُعادة للمعلمين",
  done: "مؤكدة",
  all: "الكل",
};

export function parseReviewFilter(value: string | null | undefined): ReviewFilter {
  return (REVIEW_FILTERS as readonly string[]).includes(value ?? "") ? (value as ReviewFilter) : "sent";
}

/** A teacher may edit a list until it is sent, and again once it is returned. */
export function isLocked(status: CollectionStatus | null | undefined): boolean {
  return status === "SENT" || status === "DONE";
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const NOTE_MAX = 300;

export interface LineInput {
  studentId: string;
  amount: number;
  note: string;
}

/**
 * The lines a save actually stores: only students of the halaqa, never one whose
 * line the accountant already confirmed, and only lines carrying an amount or a
 * note. Amounts are clamped at zero; a student listed twice keeps the last entry.
 */
export function pickNewLines(
  lines: readonly LineInput[],
  halaqaStudentIds: ReadonlySet<string>,
  confirmedStudentIds: ReadonlySet<string>,
): LineInput[] {
  const byStudent = new Map<string, LineInput>();
  for (const line of lines) {
    if (!halaqaStudentIds.has(line.studentId) || confirmedStudentIds.has(line.studentId)) continue;
    const amount = round2(Math.max(0, Number(line.amount) || 0));
    const note = String(line.note ?? "").trim().slice(0, NOTE_MAX);
    if (amount > 0 || note !== "") byStudent.set(line.studentId, { studentId: line.studentId, amount, note });
    else byStudent.delete(line.studentId);
  }
  return [...byStudent.values()];
}

/** After a review: anything returned → RETURNED; else lines still undecided → SENT; else DONE. */
export function resolveCollectionStatus(issues: number, pending: number): CollectionStatus {
  if (issues > 0) return "RETURNED";
  if (pending > 0) return "SENT";
  return "DONE";
}

export interface Decision {
  studentId: string;
  ok: boolean;
  note: string;
}

export interface PendingLine {
  id: string;
  studentId: string;
  amount: number;
  note: string;
}

export interface ReviewPlan {
  /** Lines to mark OK; those with an amount also become fee payments. */
  confirmed: Array<PendingLine & { accountantNote: string }>;
  /** Lines to mark ISSUE and hand back to the teacher. */
  returned: Array<{ id: string; accountantNote: string }>;
  /** Pending lines the reviewer gave no decision for. */
  pending: number;
  status: CollectionStatus;
}

/** Applies the reviewer's decisions to the lines that are still pending. Decisions for other lines are ignored. */
export function planReview(pendingLines: readonly PendingLine[], decisions: readonly Decision[]): ReviewPlan {
  const plan: ReviewPlan = { confirmed: [], returned: [], pending: 0, status: "DONE" };
  for (const line of pendingLines) {
    const decision = decisions.find((d) => d.studentId === line.studentId);
    if (!decision) plan.pending++;
    else if (decision.ok) plan.confirmed.push({ ...line, accountantNote: decision.note });
    else plan.returned.push({ id: line.id, accountantNote: decision.note });
  }
  plan.status = resolveCollectionStatus(plan.returned.length, plan.pending);
  return plan;
}

/** Note stored on the payment created from a confirmed line. */
export function paymentNote(teacherName: string | null | undefined, lineNote: string): string {
  return `تحصيل المعلم ${teacherName ?? ""}${lineNote ? ` — ${lineNote}` : ""}`;
}

/** Sum of the amounts of a list (what the teacher says they collected). */
export function linesTotal(lines: ReadonlyArray<{ amount: number | null }>): number {
  return round2(lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0));
}
