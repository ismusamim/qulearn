import type { ISODate } from "@/lib/dates";

/** Pure attendance calculations, shared by the sheet, the teacher's list and the student's own pages. */

export type AttendanceStatus = "PRESENT" | "LATE" | "EXCUSED" | "ABSENT";

/** Display order of the four states. */
export const ATTENDANCE_STATUSES: readonly AttendanceStatus[] = ["PRESENT", "LATE", "EXCUSED", "ABSENT"];

export type StatusCounts = Record<AttendanceStatus, number>;

export function emptyCounts(): StatusCounts {
  return { PRESENT: 0, LATE: 0, EXCUSED: 0, ABSENT: 0 };
}

/** Tallies marks per status; null / undefined entries (no mark yet) are ignored. */
export function countStatuses(statuses: Iterable<AttendanceStatus | null | undefined>): StatusCounts {
  const counts = emptyCounts();
  for (const status of statuses) if (status) counts[status]++;
  return counts;
}

export function totalMarks(counts: StatusCounts): number {
  return counts.PRESENT + counts.LATE + counts.EXCUSED + counts.ABSENT;
}

/**
 * Attendance percentage: a late student still attended, an excused one did not.
 * Null when nothing has been recorded (shown as «—», not as 0%).
 */
export function attendanceRate(counts: StatusCounts): number | null {
  const total = totalMarks(counts);
  if (total === 0) return null;
  return Math.round(((counts.PRESENT + counts.LATE) * 100) / total);
}

export function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${rate}%`;
}

export interface MonthSummary {
  year: number;
  /** 1–12 */
  month: number;
  counts: StatusCounts;
  total: number;
  rate: number | null;
}

/** Groups marks by calendar month, newest month first. */
export function summarizeByMonth(
  entries: ReadonlyArray<{ date: ISODate; status: AttendanceStatus }>,
): MonthSummary[] {
  const byMonth = new Map<string, StatusCounts>();
  for (const entry of entries) {
    const key = entry.date.slice(0, 7);
    let counts = byMonth.get(key);
    if (!counts) byMonth.set(key, (counts = emptyCounts()));
    counts[entry.status]++;
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, counts]) => ({
      year: Number(key.slice(0, 4)),
      month: Number(key.slice(5, 7)),
      counts,
      total: totalMarks(counts),
      rate: attendanceRate(counts),
    }));
}
