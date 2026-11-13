import { ATTENDANCE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

import type { AttendanceStatus } from "../stats";

/** Solid colours of the four states: present = success, late / excused = warning, absent = destructive. */
export const STATUS_SOLID: Record<AttendanceStatus, string> = {
  PRESENT: "border-success bg-success text-white hover:bg-success/90 hover:text-white",
  LATE: "border-warning bg-warning text-white hover:bg-warning/90 hover:text-white",
  EXCUSED: "border-warning bg-warning text-white hover:bg-warning/90 hover:text-white",
  ABSENT: "border-destructive bg-destructive text-white hover:bg-destructive/90 hover:text-white",
};

export const STATUS_TEXT: Record<AttendanceStatus, string> = {
  PRESENT: "text-success",
  LATE: "text-warning",
  EXCUSED: "text-warning",
  ABSENT: "text-destructive",
};

const STATUS_SOFT: Record<AttendanceStatus, string> = {
  PRESENT: "bg-success/10 text-success",
  LATE: "bg-warning/10 text-warning",
  EXCUSED: "bg-warning/10 text-warning",
  ABSENT: "bg-destructive/10 text-destructive",
};

export function StatusBadge({ status, className }: { status: AttendanceStatus; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-xs font-medium", STATUS_SOFT[status], className)}>
      {ATTENDANCE_LABELS[status]}
    </span>
  );
}
