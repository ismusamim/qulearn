import { monthName, todayISO } from "@/lib/dates";

/** A calendar month, the unit every fee payment and collection is recorded against. */
export interface YearMonth {
  year: number;
  month: number;
}

export function currentYearMonth(today: string = todayISO()): YearMonth {
  return { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
}

/** The month `delta` months after (or before, when negative) `base`. */
export function shiftMonth(base: YearMonth, delta: number): YearMonth {
  const index = base.year * 12 + (base.month - 1) + delta;
  return { year: Math.floor(index / 12), month: (((index % 12) + 12) % 12) + 1 };
}

/** Months from `base + from` to `base + to`, oldest first (e.g. -6…+1 for the teacher's collection page). */
export function monthOptions(base: YearMonth, from: number, to: number): YearMonth[] {
  const out: YearMonth[] = [];
  for (let k = from; k <= to; k++) out.push(shiftMonth(base, k));
  return out;
}

/** URL / select value for a month: "2026-3". */
export function monthKey(ym: YearMonth): string {
  return `${ym.year}-${ym.month}`;
}

/** Parses a monthKey; anything malformed falls back (search params are user input). */
export function parseMonthKey(value: string | null | undefined, fallback: YearMonth): YearMonth {
  const match = /^(\d{4})-(\d{1,2})$/.exec(value ?? "");
  if (!match) return fallback;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return month >= 1 && month <= 12 && year >= 2000 && year <= 2100 ? { year, month } : fallback;
}

export function sameMonth(a: YearMonth, b: YearMonth): boolean {
  return a.year === b.year && a.month === b.month;
}

/** «مارس 2026» */
export function monthLabel(ym: YearMonth): string {
  return `${monthName(ym.month)} ${ym.year}`;
}

/** Options for a month dropdown, always containing the selected month even when it is out of range. */
export function monthOptionsWith(selected: YearMonth, base: YearMonth, from: number, to: number): YearMonth[] {
  const options = monthOptions(base, from, to);
  return options.some((o) => sameMonth(o, selected)) ? options : [selected, ...options];
}
