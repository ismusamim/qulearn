import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { PrintButton } from "@/components/shared/print-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AttendanceDays, AttendanceMonths } from "@/features/attendance/components/attendance-history";
import { formatRate } from "@/features/attendance/stats";
import { RecitationsTable } from "@/features/recitations/components/recitations-table";
import { getMyRecord } from "@/features/recitations/service";
import { hasRole, requirePage } from "@/server/auth";

export const metadata: Metadata = { title: "السجل" };

export default async function HistoryPage() {
  const auth = await requirePage((a) => hasRole(a, "STUDENT"));
  const record = await getMyRecord(auth);

  return (
    <>
      <PageHeader title="السجل" description="كل ما سُجِّل لك من تسميع وحضور.">
        <PrintButton />
      </PageHeader>
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>سجل التسميع</CardTitle>
            <CardDescription>عدد التسميعات: {record.stats.recitationCount}</CardDescription>
          </CardHeader>
          <CardContent>
            <RecitationsTable recitations={record.recitations} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>سجل الحضور</CardTitle>
            <CardDescription>
              نسبة الحضور: <span dir="ltr">{formatRate(record.stats.attendanceRate)}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <AttendanceMonths entries={record.attendance} />
            {record.attendance.length > 0 && <AttendanceDays entries={record.attendance} />}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
