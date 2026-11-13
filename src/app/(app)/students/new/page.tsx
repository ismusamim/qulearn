import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { StudentForm } from "@/features/students/components/student-form";
import { getStudentFormOptions } from "@/features/students/queries";
import { todayISO } from "@/lib/dates";
import { can, requirePage } from "@/server/auth";

export const metadata: Metadata = { title: "استمارة تقديم" };

export default async function NewStudentPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const auth = await requirePage((a) => can(a, "students.add"));
  const [options, searchParams] = await Promise.all([getStudentFormOptions(auth), props.searchParams]);
  // Arriving from a list filtered by halaqa starts the form in that halaqa.
  const preset = options.halaqat.find((h) => h.id === searchParams.halaqaId)?.id ?? "";

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="استمارة تقديم" description="صغير له ولي أمر، أو كبير." />
      <StudentForm options={options} presetHalaqaId={preset} today={todayISO()} />
    </div>
  );
}
