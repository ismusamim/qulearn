import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { AbsenceForm } from "@/features/absences/components/absence-form";
import { AbsencesLog } from "@/features/absences/components/absences-log";
import { getAbsenceFormOptions, getAbsenceMonth } from "@/features/absences/service";
import { hasRole, requirePage } from "@/server/auth";

export const metadata: Metadata = { title: "غياب المعلمين" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function intParam(value: string | string[] | undefined, min: number, max: number): number | null {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

export default async function AbsencesPage(props: { searchParams: SearchParams }) {
  const auth = await requirePage((a) => hasRole(a, "ADMIN", "SUPERVISOR"));
  const [params, options] = await Promise.all([props.searchParams, getAbsenceFormOptions(auth)]);
  // The log opens on the payroll month new absences are being charged to.
  const year = intParam(params.y, 2000, 2100) ?? options.payMonth.year;
  const month = intParam(params.m, 1, 12) ?? options.payMonth.month;
  const log = await getAbsenceMonth(auth, { year, month });

  return (
    <>
      <PageHeader title="غياب المعلمين" description="سجّل غياب المعلم يومًا بيوم؛ السجل يُعرض بشهر المرتب ويغذّي رصيد الإجازات." />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <AbsenceForm options={options} />
        <AbsencesLog data={log} />
      </div>
    </>
  );
}
