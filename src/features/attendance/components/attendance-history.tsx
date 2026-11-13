import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ATTENDANCE_LABELS } from "@/lib/constants";
import { type ISODate, monthName, weekdayName } from "@/lib/dates";

import { ATTENDANCE_STATUSES, type AttendanceStatus, formatRate, summarizeByMonth } from "../stats";
import { STATUS_TEXT, StatusBadge } from "./status-badge";

type Entry = { date: ISODate; status: AttendanceStatus };

/** One row per month: how many days in each state and the month's percentage. */
export function AttendanceMonths({ entries }: { entries: Entry[] }) {
  const months = summarizeByMonth(entries);
  if (months.length === 0) return <EmptyState title="لم يُسجَّل حضور بعد." />;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>الشهر</TableHead>
          {ATTENDANCE_STATUSES.map((status) => (
            <TableHead key={status}>{ATTENDANCE_LABELS[status]}</TableHead>
          ))}
          <TableHead>الأيام</TableHead>
          <TableHead>النسبة</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {months.map((m) => (
          <TableRow key={`${m.year}-${m.month}`}>
            <TableCell className="font-medium">
              {monthName(m.month)} <span dir="ltr">{m.year}</span>
            </TableCell>
            {ATTENDANCE_STATUSES.map((status) => (
              <TableCell key={status} className={m.counts[status] > 0 ? STATUS_TEXT[status] : "text-muted-foreground"}>
                {m.counts[status]}
              </TableCell>
            ))}
            <TableCell>{m.total}</TableCell>
            <TableCell className="font-medium">
              <span dir="ltr">{formatRate(m.rate)}</span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Day-by-day log, newest first. */
export function AttendanceDays({ entries }: { entries: Entry[] }) {
  if (entries.length === 0) return <EmptyState title="لم يُسجَّل حضور بعد." />;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>التاريخ</TableHead>
          <TableHead>اليوم</TableHead>
          <TableHead>الحالة</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.date}>
            <TableCell>
              <span dir="ltr">{entry.date}</span>
            </TableCell>
            <TableCell className="text-muted-foreground">{weekdayName(entry.date)}</TableCell>
            <TableCell>
              <StatusBadge status={entry.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
