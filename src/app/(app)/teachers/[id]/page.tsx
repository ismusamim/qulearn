import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { z } from "zod";

import { PageHeader } from "@/components/shared/page-header";
import { TeacherEditor } from "@/features/teachers/components/teacher-editor";
import { TeacherStatusBadge, TeacherWorkingButton } from "@/features/teachers/components/teacher-status";
import { type TeacherFileView, getTeacherFile } from "@/features/teachers/service";
import { hasRole, requirePage } from "@/server/auth";
import { NotFoundError } from "@/server/errors";

export const metadata: Metadata = { title: "تعديل بيانات معلم" };

export default async function TeacherPage(props: { params: Promise<{ id: string }> }) {
  const auth = await requirePage((a) => hasRole(a, "ADMIN"));
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();

  let file: TeacherFileView;
  try {
    file = await getTeacherFile(auth, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  const { teacher, customFields } = file;
  const halaqat = teacher.halaqat.map((h) => h.label).join("، ");

  return (
    <>
      <PageHeader
        title={`تعديل بيانات: ${teacher.name}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <TeacherStatusBadge status={teacher.administrative.status} />
            <span>
              {halaqat ? `${halaqat} — ${teacher.studentCount} طالب` : "لم تُسند إليه حلقة بعد"}
            </span>
          </span>
        }
      >
        <TeacherWorkingButton teacher={{ id: teacher.id, name: teacher.name, status: teacher.administrative.status }} />
      </PageHeader>
      {/* Remount when the status changes outside the form, so the «الحالة» field never shows a stale value. */}
      <TeacherEditor key={teacher.administrative.status} teacher={teacher} customFields={customFields} />
    </>
  );
}
