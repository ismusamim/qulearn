import "server-only";

import type { ATTENDANCE_LABELS, RECITATION_TYPE_LABELS } from "@/lib/constants";
import { fromISODate, type ISODate, todayISO, toISODate } from "@/lib/dates";
import { SURAHS } from "@/lib/quran";
import { type AuthContext, assertRole } from "@/server/auth";
import { db } from "@/server/db";

type AttendanceStatus = keyof typeof ATTENDANCE_LABELS;

export interface DashboardDTO {
  today: ISODate;
  counts: {
    teachers: number;
    supervisors: number;
    places: number;
    halaqat: number;
    students: number;
    droppedStudents: number;
  };
  /** Today's attendance, as recorded so far. */
  attendance: {
    byStatus: Record<AttendanceStatus, number>;
    recorded: number;
    /** Present or late, as a percentage of the recorded rows; null when nothing is recorded yet. */
    rate: number | null;
    /** Regular students who belong to a halaqa and have no row for today. */
    unrecorded: number;
  };
  /** Recitations dated within the last seven days. */
  weekRecitations: number;
  recentRecitations: Array<{
    id: string;
    studentId: string;
    studentName: string;
    date: ISODate;
    type: keyof typeof RECITATION_TYPE_LABELS;
    surahName: string;
    fromAyah: number;
    toAyah: number;
    grade: string | null;
    recordedByName: string | null;
  }>;
  /** Regular students not placed in any halaqa yet. */
  unassigned: { count: number; students: Array<{ id: string; name: string }> };
  /** Latest announcements addressed to admins (or to everyone), and notes sent to the administration. */
  news: Array<{ id: string; text: string; date: ISODate; authorLabel: string | null }>;
}

const RECENT_RECITATIONS = 8;
const UNASSIGNED_PREVIEW = 8;
const NEWS_PREVIEW = 5;

/** Everything the admin's home page shows, in one round of aggregate queries. */
export async function getDashboard(auth: AuthContext): Promise<DashboardDTO> {
  assertRole(auth, "ADMIN");
  const today = todayISO();
  const todayDate = fromISODate(today);
  const weekAgo = new Date(todayDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  const unassignedWhere = { role: "STUDENT", studentProfile: { halaqaId: null, status: "ACTIVE" } } as const;

  const [roles, places, halaqat, dropped, attendance, expectedToday, recordedExpected, weekRecitations, recent, unassignedCount, unassigned, news] =
    await Promise.all([
      db.member.groupBy({ by: ["role"], _count: { _all: true } }),
      db.place.count(),
      db.halaqa.count(),
      db.studentProfile.count({ where: { status: "DROPPED" } }),
      db.attendance.groupBy({ by: ["status"], where: { date: todayDate }, _count: { _all: true } }),
      db.studentProfile.count({ where: { status: "ACTIVE", halaqaId: { not: null } } }),
      db.attendance.count({
        where: { date: todayDate, student: { studentProfile: { status: "ACTIVE", halaqaId: { not: null } } } },
      }),
      db.recitation.count({ where: { date: { gte: weekAgo } } }),
      db.recitation.findMany({
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: RECENT_RECITATIONS,
        select: {
          id: true,
          studentId: true,
          date: true,
          type: true,
          surah: true,
          fromAyah: true,
          toAyah: true,
          grade: true,
          student: { select: { name: true } },
          recordedBy: { select: { name: true } },
        },
      }),
      db.member.count({ where: unassignedWhere }),
      db.member.findMany({
        where: unassignedWhere,
        select: { id: true, name: true },
        orderBy: { name: "asc" },
        take: UNASSIGNED_PREVIEW,
      }),
      db.news.findMany({
        where: { audience: { in: ["ALL", "ADMIN"] } },
        orderBy: { createdAt: "desc" },
        take: NEWS_PREVIEW,
        select: { id: true, text: true, date: true, authorLabel: true },
      }),
    ]);

  const roleCount = (role: string) => roles.find((r) => r.role === role)?._count._all ?? 0;
  const byStatus: Record<AttendanceStatus, number> = { PRESENT: 0, LATE: 0, EXCUSED: 0, ABSENT: 0 };
  for (const row of attendance) byStatus[row.status] = row._count._all;
  const recorded = byStatus.PRESENT + byStatus.LATE + byStatus.EXCUSED + byStatus.ABSENT;

  return {
    today,
    counts: {
      teachers: roleCount("TEACHER"),
      supervisors: roleCount("SUPERVISOR"),
      places,
      halaqat,
      students: roleCount("STUDENT"),
      droppedStudents: dropped,
    },
    attendance: {
      byStatus,
      recorded,
      rate: recorded ? Math.round(((byStatus.PRESENT + byStatus.LATE) * 100) / recorded) : null,
      unrecorded: Math.max(0, expectedToday - recordedExpected),
    },
    weekRecitations,
    recentRecitations: recent.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      studentName: r.student.name,
      date: toISODate(r.date),
      type: r.type,
      surahName: SURAHS[r.surah - 1]?.name ?? String(r.surah),
      fromAyah: r.fromAyah,
      toAyah: r.toAyah,
      grade: r.grade,
      recordedByName: r.recordedBy?.name ?? null,
    })),
    unassigned: { count: unassignedCount, students: unassigned },
    news: news.map((n) => ({ id: n.id, text: n.text, date: toISODate(n.date), authorLabel: n.authorLabel })),
  };
}
