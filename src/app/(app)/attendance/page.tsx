import type { Metadata } from "next";

import { CalendarCheckIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PrintButton } from "@/components/shared/print-button";
import { AttendanceSheet } from "@/features/attendance/components/attendance-sheet";
import { DateParamInput } from "@/features/attendance/components/date-param-input";
import { HalaqaSelect } from "@/features/attendance/components/halaqa-select";
import { getAttendanceSheet } from "@/features/attendance/service";
import { isISODate, todayISO } from "@/lib/dates";
import { hasRole, requirePage } from "@/server/auth";

export const metadata: Metadata = { title: "الحضور" };

export default async function AttendancePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await requirePage((a) => hasRole(a, "TEACHER", "SUPERVISOR", "ADMIN"));
  const { halaqa, date } = await props.searchParams;
  const sheet = await getAttendanceSheet(auth, {
    halaqaId: typeof halaqa === "string" ? halaqa : undefined,
    date: isISODate(date) ? date : todayISO(),
  });
  const current = sheet.halaqat.find((h) => h.id === sheet.halaqaId);

  return (
    <>
      <PageHeader title="الحضور" description={current ? current.label : "حاضر / متأخر / معتذر / غائب، بالتاريخ."}>
        {current && <PrintButton />}
      </PageHeader>
      {sheet.halaqat.length === 0 ? (
        <EmptyState
          icon={CalendarCheckIcon}
          title={auth.role === "ADMIN" ? "لا توجد حلقات بعد." : "لم تُسنَد إليك حلقة بعد. تواصل مع الإدارة."}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="no-print flex flex-wrap items-center gap-3">
            <HalaqaSelect halaqat={sheet.halaqat} value={sheet.halaqaId} />
            <DateParamInput value={sheet.date} />
          </div>
          {sheet.halaqaId ? (
            <AttendanceSheet
              // A different halaqa or day is a different sheet: drop any optimistic state.
              key={`${sheet.halaqaId}:${sheet.date}`}
              halaqaId={sheet.halaqaId}
              date={sheet.date}
              students={sheet.students}
              droppedCount={sheet.droppedCount}
            />
          ) : (
            <EmptyState icon={CalendarCheckIcon} title="اختر الحلقة لعرض كشف حضورها." />
          )}
        </div>
      )}
    </>
  );
}
