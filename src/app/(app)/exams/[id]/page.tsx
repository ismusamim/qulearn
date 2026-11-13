import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowRightIcon, PencilIcon } from "lucide-react";
import { z } from "zod";

import { PageHeader } from "@/components/shared/page-header";
import { PrintButton } from "@/components/shared/print-button";
import { Button } from "@/components/ui/button";
import { ExamFormDialog } from "@/features/exams/components/exam-form-dialog";
import { ExamView } from "@/features/exams/components/exam-view";
import { findExam } from "@/features/exams/service";
import { getMarkingSettings, listCompetitions } from "@/features/exams/settings-service";
import { hasRole, requirePage } from "@/server/auth";

export const metadata: Metadata = { title: "نتيجة اختبار" };

export default async function ExamPage(props: { params: Promise<{ id: string }> }) {
  const auth = await requirePage((a) => hasRole(a, "TEACHER", "SUPERVISOR", "ADMIN"));
  const { id } = await props.params;
  const exam = z.uuid().safeParse(id).success ? await findExam(auth, id) : null;
  if (!exam) notFound();

  // The edit form is only built for the admin or whoever ran the exam.
  const [competitions, settings] = exam.canModify
    ? await Promise.all([listCompetitions(auth), getMarkingSettings(auth)])
    : [null, null];

  return (
    <>
      <PageHeader title="نتيجة اختبار">
        <Button asChild variant="ghost">
          <Link href="/exams">
            <ArrowRightIcon />
            الاختبارات
          </Link>
        </Button>
        {competitions && settings && (
          <ExamFormDialog exam={exam} types={[exam.type]} students={[]} competitions={competitions} settings={settings}>
            <Button variant="outline">
              <PencilIcon />
              تعديل
            </Button>
          </ExamFormDialog>
        )}
        <PrintButton />
      </PageHeader>
      <ExamView exam={exam} />
    </>
  );
}
