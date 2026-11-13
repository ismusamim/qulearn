import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { z } from "zod";

import { PageHeader } from "@/components/shared/page-header";
import { StudentForm } from "@/features/students/components/student-form";
import { getStudent, getStudentFormOptions } from "@/features/students/queries";
import { todayISO } from "@/lib/dates";
import { hasRole, requirePage } from "@/server/auth";
import { NotFoundError } from "@/server/errors";

export const metadata: Metadata = { title: "تعديل بيانات الطالب" };

export default async function EditStudentPage(props: { params: Promise<{ id: string }> }) {
  // Editing a saved form is the admin's alone; updateStudent enforces it again.
  const auth = await requirePage((a) => hasRole(a, "ADMIN"));
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [student, options] = await Promise.all([
    getStudent(auth, id).catch((error: unknown) => {
      if (error instanceof NotFoundError) notFound();
      throw error;
    }),
    getStudentFormOptions(auth),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`تعديل بيانات: ${student.name}`} />
      <StudentForm student={student} options={options} today={todayISO()} />
    </div>
  );
}
