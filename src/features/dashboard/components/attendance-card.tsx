import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ATTENDANCE_LABELS } from "@/lib/constants";

import type { DashboardDTO } from "../service";

const STATUSES = [
  { key: "PRESENT", color: "bg-success" },
  { key: "LATE", color: "bg-warning" },
  { key: "EXCUSED", color: "bg-gold" },
  { key: "ABSENT", color: "bg-destructive" },
] as const;

/** Today's attendance by status, with how many regular students are still unrecorded. */
export function AttendanceCard({ attendance }: { attendance: DashboardDTO["attendance"] }) {
  const { byStatus, recorded, rate, unrecorded } = attendance;

  return (
    <Card>
      <CardHeader>
        <CardTitle>حضور اليوم</CardTitle>
        <CardDescription>
          {recorded ? `سُجّل ${recorded} طالب` : "لم يُسجَّل حضور اليوم بعد"}
          {unrecorded > 0 ? ` · ${unrecorded} لم يُسجَّل بعد` : ""}
        </CardDescription>
        <CardAction>
          <Button asChild variant="outline" size="sm">
            <Link href="/attendance">تسجيل الحضور</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-baseline gap-2">
          <b dir="ltr" className="text-3xl font-bold text-primary tabular-nums">
            {rate === null ? "—" : `${rate}%`}
          </b>
          <span className="text-muted-foreground">نسبة الحضور (حاضر ومتأخر)</span>
        </div>
        {recorded > 0 && (
          <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
            {STATUSES.filter((s) => byStatus[s.key] > 0).map((s) => (
              <div key={s.key} className={s.color} style={{ flexGrow: byStatus[s.key] }} />
            ))}
          </div>
        )}
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STATUSES.map((s) => (
            <div key={s.key} className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2">
              <span className={`size-2.5 shrink-0 rounded-full ${s.color}`} aria-hidden="true" />
              <dt className="text-muted-foreground">{ATTENDANCE_LABELS[s.key]}</dt>
              <dd dir="ltr" className="ms-auto font-semibold tabular-nums">
                {byStatus[s.key]}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
