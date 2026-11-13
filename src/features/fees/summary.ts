import { normalizeArabic } from "@/lib/arabic";

/**
 * Where a student stands for one month:
 *  DROPPED      منقطع (not counted as expected)
 *  EXEMPT       due is 0 (e.g. «أيتام» 100%)
 *  PAID/PARTIAL/UNPAID  against a known due
 *  PAID_NO_FEE  paid something although no due could be determined
 *  NO_FEE       no own amount, no category, nothing paid
 */
export type FeeState = "DROPPED" | "EXEMPT" | "PAID" | "PARTIAL" | "UNPAID" | "PAID_NO_FEE" | "NO_FEE";

const round2 = (n: number) => Math.round(n * 100) / 100;

export function feeState(due: number | null, paid: number, dropped: boolean): FeeState {
  if (dropped) return "DROPPED";
  if (due === 0) return "EXEMPT";
  if (due != null) return paid >= due ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID";
  return paid > 0 ? "PAID_NO_FEE" : "NO_FEE";
}

/** What is still owed for the month; 0 when the due is unknown or already covered. */
export function remainingOf(due: number | null, paid: number): number {
  return due ? round2(Math.max(0, due - paid)) : 0;
}

export interface FeeSummary {
  /** Everything paid for the month, dropped students included. */
  collected: number;
  /** Sum of dues of active students. */
  expected: number;
  /** What active students still owe. */
  outstanding: number;
  paidCount: number;
  partialCount: number;
  unpaidCount: number;
  exemptCount: number;
  droppedCount: number;
}

export function summarizeFees(rows: ReadonlyArray<{ due: number | null; paid: number; dropped: boolean }>): FeeSummary {
  const s: FeeSummary = {
    collected: 0,
    expected: 0,
    outstanding: 0,
    paidCount: 0,
    partialCount: 0,
    unpaidCount: 0,
    exemptCount: 0,
    droppedCount: 0,
  };
  for (const row of rows) {
    s.collected += row.paid;
    switch (feeState(row.due, row.paid, row.dropped)) {
      case "DROPPED":
        s.droppedCount++;
        break;
      case "EXEMPT":
        s.exemptCount++;
        break;
      case "PAID":
      case "PAID_NO_FEE":
        s.paidCount++;
        break;
      case "PARTIAL":
        s.partialCount++;
        break;
      case "UNPAID":
        s.unpaidCount++;
        break;
      case "NO_FEE":
        break;
    }
    if (!row.dropped && row.due) {
      s.expected += row.due;
      s.outstanding += remainingOf(row.due, row.paid);
    }
  }
  s.collected = round2(s.collected);
  s.expected = round2(s.expected);
  s.outstanding = round2(s.outstanding);
  return s;
}

/**
 * «بداية الاسم» search used for halaqa and place names: matches the start of the
 * whole text or the start of any word in it. `query` must already be normalised.
 */
export function startsWithWord(text: string | null | undefined, query: string): boolean {
  if (!query) return true;
  const value = String(text ?? "");
  return normalizeArabic(value).startsWith(query) || value.split(/\s+/).some((w) => normalizeArabic(w).startsWith(query));
}

/** «50%» or «30 جنيه», for describing a discount. */
export function discountText(type: "PERCENT" | "AMOUNT", value: number, money: (n: number) => string, currency: string): string {
  return type === "AMOUNT" ? `${money(value)} ${currency}` : `${value}%`;
}
