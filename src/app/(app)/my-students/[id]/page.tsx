import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowRightIcon, BookOpenIcon } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { PrintButton } from "@/components/shared/print-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AttendanceMonths } from "@/features/attendance/components/attendance-history";
import { RecitationDialogTrigger } from "@/features/recitations/components/recitation-dialog";
import { RecitationsTable } from "@/features/recitations/components/recitations-table";
import { HalaqaLine, StudentStats } from "@/features/recitations/components/student-stats";
import { getStudentRecord } from "@/features/recitations/service";
import { hasRole, requirePage } from "@/server/auth";
import { ForbiddenError, NotFoundError } from "@/server/errors";

export const metadata: Metadata = { title: "سجل الطالب" };

export default async function StudentRecordPage(props: { params: Promise<{ id: string }> }) {
  const auth = await requirePage((a) => hasRole(a, "TEACHER", "SUPERVISOR", "ADMIN"));
  const { id } = await props.params;
  const record = await getStudentRecord(auth, id).catch((error: unknown) => {
    // Someone else's student looks the same as a student that does not exist.
    if (error instanceof NotFoundError || error instanceof ForbiddenError) notFound();
    throw error;
  });
  const { student } = record;

  return (
    <>
      <PageHeader
        title={`سجل: ${student.name}`}
        description={
          <>
            {student.dropped && (
              <Badge variant="destructive" className="me-2">
                منقطع
              </Badge>
            )}
            <HalaqaLine student={student} />
          </>
        }
      >
        <Button variant="ghost" asChild>
          <Link href="/my-students">
            <ArrowRightIcon />
            رجوع
          </Link>
        </Button>
        <PrintButton />
        {record.canRecord && (
          <RecitationDialogTrigger student={{ id: student.id, name: student.name }}>
            <Button>
              <BookOpenIcon />
              تسجيل تسميع
            </Button>
          </RecitationDialogTrigger>
        )}
      </PageHeader>
      <div className="flex flex-col gap-6">
        <StudentStats stats={record.stats} />
        <Card>
          <CardHeader>
            <CardTitle>سجل التسميع</CardTitle>
          </CardHeader>
          <CardContent>
            <RecitationsTable recitations={record.recitations} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>الحضور بالشهور</CardTitle>
          </CardHeader>
          <CardContent>
            <AttendanceMonths entries={record.attendance} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
