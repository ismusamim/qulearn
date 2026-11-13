"use client";

import { useOptimistic, useTransition } from "react";

import { CheckCheckIcon, UsersIcon } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ATTENDANCE_LABELS } from "@/lib/constants";
import type { ISODate } from "@/lib/dates";
import { cn } from "@/lib/utils";

import { markAllPresentAction, setAttendanceAction } from "../actions";
import type { SheetStudentDTO } from "../service";
import { ATTENDANCE_STATUSES, type AttendanceStatus, countStatuses } from "../stats";
import { STATUS_SOLID, STATUS_TEXT } from "./status-badge";

type Change = { kind: "one"; studentId: string; status: AttendanceStatus | null } | { kind: "allPresent" };

function applyChange(students: SheetStudentDTO[], change: Change): SheetStudentDTO[] {
  return students.map((s) => {
    if (change.kind === "one") return s.id === change.studentId ? { ...s, status: change.status } : s;
    return s.status === null ? { ...s, status: "PRESENT" } : s;
  });
}

/**
 * The day's sheet. Every tap is saved at once. The mark is shown optimistically
 * while the request runs and falls back to the saved value if it fails, so this
 * component drives its own transition (useOptimistic must be updated inside it)
 * instead of going through the useAction hook.
 */
export function AttendanceSheet({
  halaqaId,
  date,
  students,
  droppedCount,
}: {
  halaqaId: string;
  date: ISODate;
  students: SheetStudentDTO[];
  droppedCount: number;
}) {
  const [pending, startTransition] = useTransition();
  const [rows, applyOptimistic] = useOptimistic(students, applyChange);

  const counts = countStatuses(rows.map((s) => s.status));
  const unmarked = rows.filter((s) => s.status === null).length;

  const mark = (student: SheetStudentDTO, status: AttendanceStatus) => {
    // Tapping the current state again clears the mark.
    const next = student.status === status ? null : status;
    startTransition(async () => {
      applyOptimistic({ kind: "one", studentId: student.id, status: next });
      const result = await setAttendanceAction({ studentId: student.id, date, status: next });
      if (!result.ok) toast.error(result.error);
    });
  };

  const markAll = () => {
    startTransition(async () => {
      applyOptimistic({ kind: "allPresent" });
      const result = await markAllPresentAction({ halaqaId, date });
      if (!result.ok) toast.error(result.error);
      else if (result.data.count > 0) toast.success(`سُجِّل ${result.data.count} حاضرًا`);
    });
  };

  if (students.length === 0) {
    return (
      <EmptyState
        icon={UsersIcon}
        title="لا يوجد طلاب في هذه الحلقة."
        description={droppedCount > 0 ? `فيها ${droppedCount} طالب منقطع لا يُسجَّل له حضور.` : undefined}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          كشف الحضور <span dir="ltr" className="text-muted-foreground">{date}</span>
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1" aria-live="polite">
          {ATTENDANCE_STATUSES.map((status) => (
            <span key={status}>
              {ATTENDANCE_LABELS[status]}: <b className={STATUS_TEXT[status]}>{counts[status]}</b>
            </span>
          ))}
          <span>
            لم يُسجَّل: <b className={unmarked > 0 ? "text-foreground" : undefined}>{unmarked}</b>
          </span>
          <span>الإجمالي: {rows.length}</span>
        </CardDescription>
        <CardAction className="no-print">
          <Button
            size="sm"
            onClick={markAll}
            disabled={unmarked === 0 || pending}
            title="يُسجَّل حاضرًا كل من لم تُسجَّل له حالة بعد"
          >
            <CheckCheckIcon />
            الكل حاضر
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">م</TableHead>
              <TableHead>الطالب</TableHead>
              <TableHead>الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((student, index) => (
              <TableRow key={student.id}>
                <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                <TableCell className="font-medium">
                  {student.name}
                  {student.status === null && (
                    <Badge variant="outline" className="ms-2 text-muted-foreground">
                      لم يُسجَّل
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1" role="group" aria-label={`حضور ${student.name}`}>
                    {ATTENDANCE_STATUSES.map((status) => {
                      const active = student.status === status;
                      return (
                        <Button
                          key={status}
                          type="button"
                          size="sm"
                          variant="outline"
                          aria-pressed={active}
                          className={cn(active ? STATUS_SOLID[status] : "no-print")}
                          onClick={() => mark(student, status)}
                        >
                          {ATTENDANCE_LABELS[status]}
                        </Button>
                      );
                    })}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {droppedCount > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            في الحلقة {droppedCount} طالب منقطع لا يظهر في الكشف.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
