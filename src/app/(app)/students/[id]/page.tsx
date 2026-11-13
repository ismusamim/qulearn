import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowRightIcon, PencilIcon } from "lucide-react";
import { z } from "zod";

import { PageHeader } from "@/components/shared/page-header";
import { PrintButton } from "@/components/shared/print-button";
import { Button } from "@/components/ui/button";
import { StudentFile } from "@/features/students/components/student-file";
import { DeleteStudentButton } from "@/features/students/components/student-file-actions";
import { canOpenStudents, getStudent, studentCaps } from "@/features/students/queries";
import { requirePage } from "@/server/auth";
import { NotFoundError } from "@/server/errors";

export const metadata: Metadata = { title: "ملف الطالب" };

export default async function StudentFilePage(props: { params: Promise<{ id: string }> }) {
  const auth = await requirePage(canOpenStudents);
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();
  const student = await getStudent(auth, id).catch((error: unknown) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  const caps = studentCaps(auth);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="ملف الطالب">
        <Button variant="ghost" asChild>
          <Link href="/students">
            <ArrowRightIcon />
            الطلاب
          </Link>
        </Button>
        {caps.edit && (
          <Button asChild>
            <Link href={`/students/${student.id}/edit`}>
              <PencilIcon />
              تعديل
            </Link>
          </Button>
        )}
        <PrintButton />
        {caps.remove && <DeleteStudentButton student={{ id: student.id, name: student.name }} />}
      </PageHeader>
      <StudentFile student={student} />
    </div>
  );
}
