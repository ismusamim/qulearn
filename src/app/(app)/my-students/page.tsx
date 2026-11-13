import type { Metadata } from "next";

import { UsersIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { HalaqaSelect } from "@/features/attendance/components/halaqa-select";
import { StudentsBoard } from "@/features/recitations/components/students-board";
import { listMyStudents } from "@/features/recitations/service";
import { hasRole, requirePage } from "@/server/auth";

export const metadata: Metadata = { title: "الطلاب والتسميع" };

/** The same page is «طلابي» for a teacher, «الطلاب» for a supervisor and «التسميع» for an admin. */
const TITLES = { TEACHER: "طلابي", SUPERVISOR: "الطلاب", ADMIN: "التسميع" } as const;

export default async function MyStudentsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await requirePage((a) => hasRole(a, "TEACHER", "SUPERVISOR", "ADMIN"));
  const { halaqa } = await props.searchParams;
  const data = await listMyStudents(auth, { halaqaId: typeof halaqa === "string" ? halaqa : undefined });
  const title = TITLES[auth.role as keyof typeof TITLES] ?? TITLES.TEACHER;

  return (
    <>
      <PageHeader title={title} description="تسجيل التسميع (حفظ / مراجعة / تثبيت) وسجل كل طالب." />
      {data.halaqat.length === 0 && auth.role !== "ADMIN" ? (
        <EmptyState icon={UsersIcon} title="لم تُسنَد إليك حلقة بعد." />
      ) : (
        <div className="flex flex-col gap-4">
          {data.halaqat.length > 1 && (
            <div className="no-print">
              <HalaqaSelect halaqat={data.halaqat} value={data.halaqaId} allLabel="كل الحلقات" />
            </div>
          )}
          <StudentsBoard students={data.students} showHalaqa={data.halaqaId === null && data.halaqat.length > 1} />
        </div>
      )}
    </>
  );
}
