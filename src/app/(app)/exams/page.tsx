import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { CompetitionsCard } from "@/features/exams/components/competitions-card";
import { ExamsTable } from "@/features/exams/components/exams-table";
import { MarkingSettingsCard } from "@/features/exams/components/marking-settings-card";
import { SupervisorNotes } from "@/features/exams/components/supervisor-notes";
import { allowedExamTypes, isExamType } from "@/features/exams/rules";
import { listExaminableStudents, listExams, listSupervisorNotes } from "@/features/exams/service";
import { getMarkingSettings, listCompetitions } from "@/features/exams/settings-service";
import { hasRole, requirePage } from "@/server/auth";

export const metadata: Metadata = { title: "الاختبارات" };

export default async function ExamsPage(props: { searchParams: Promise<{ type?: string | string[] }> }) {
  const auth = await requirePage((a) => hasRole(a, "TEACHER", "SUPERVISOR", "ADMIN"));
  const { type } = await props.searchParams;
  const filterType = isExamType(type) ? type : undefined;

  const [exams, students, competitions, settings, notes] = await Promise.all([
    listExams(auth, { type: filterType }),
    listExaminableStudents(auth),
    listCompetitions(auth),
    getMarkingSettings(auth),
    listSupervisorNotes(auth),
  ]);

  return (
    <>
      <PageHeader
        title="الاختبارات"
        description="متابعة ودوري وإتقان ومسابقة — التصحيح بالخصم من درجة السؤال: الأخطاء والتنبيهات وأخطاء التجويد."
      />
      <div className="flex flex-col gap-6">
        <SupervisorNotes notes={notes} memberId={auth.memberId} />
        <ExamsTable
          exams={exams}
          filterType={filterType}
          types={allowedExamTypes(auth.role)}
          students={students}
          competitions={competitions}
          settings={settings}
        />
        {auth.role === "ADMIN" && (
          <>
            <MarkingSettingsCard settings={settings} />
            <CompetitionsCard competitions={competitions} />
          </>
        )}
      </div>
    </>
  );
}
