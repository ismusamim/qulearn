"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { ClipboardCheckIcon, EyeIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAction } from "@/hooks/use-action";

import { deleteExamAction } from "../actions";
import { EXAM_TYPES, EXAM_TYPE_LABELS, type ExamType } from "../rules";
import type { MarkingSettings } from "../scoring";
import type { ExaminableStudentDTO, ExamSummaryDTO } from "../service";
import type { CompetitionDTO } from "../settings-service";
import { ExamFormDialog } from "./exam-form-dialog";
import { ExamScore, ExamTypeBadge } from "./exam-type-badge";

const ALL = "ALL";

export function ExamsTable({
  exams,
  filterType,
  types,
  students,
  competitions,
  settings,
}: {
  exams: ExamSummaryDTO[];
  /** The type filter currently applied (from the URL). */
  filterType?: ExamType;
  /** The exam types the user may run; none hides «اختبار جديد». */
  types: ExamType[];
  students: ExaminableStudentDTO[];
  competitions: CompetitionDTO[];
  settings: MarkingSettings;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const remove = useAction(deleteExamAction, { successMessage: "تم حذف الاختبار" });

  return (
    <Card>
      <CardHeader>
        <CardTitle>الاختبارات ({exams.length})</CardTitle>
        <CardAction className="no-print flex flex-wrap items-center gap-2">
          <Select value={filterType ?? ALL} onValueChange={(value) => router.push(value === ALL ? pathname : `${pathname}?type=${value}`)}>
            <SelectTrigger size="sm" aria-label="نوع الاختبار">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>كل الأنواع</SelectItem>
              {EXAM_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {EXAM_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {types.length > 0 && (
            <ExamFormDialog types={types} students={students} competitions={competitions} settings={settings}>
              <Button size="sm">
                <PlusIcon />
                اختبار جديد
              </Button>
            </ExamFormDialog>
          )}
        </CardAction>
      </CardHeader>
      <CardContent>
        {exams.length === 0 ? (
          <EmptyState icon={ClipboardCheckIcon} title="لا توجد اختبارات بعد." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>الطالب</TableHead>
                <TableHead>الحلقة</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>المختبِر</TableHead>
                <TableHead>الدرجة</TableHead>
                <TableHead>التقدير</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {exams.map((exam, i) => (
                <TableRow key={exam.id}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell dir="ltr" className="text-end">
                    {exam.date}
                  </TableCell>
                  <TableCell className="font-medium">{exam.studentName}</TableCell>
                  <TableCell className="text-muted-foreground">{exam.halaqaLabel || "—"}</TableCell>
                  <TableCell>
                    <ExamTypeBadge type={exam.type} juz={exam.juz} levelName={exam.levelName} />
                  </TableCell>
                  <TableCell>{exam.examinerName || "—"}</TableCell>
                  <TableCell>
                    <ExamScore total={exam.total} maxScore={exam.maxScore} />
                  </TableCell>
                  <TableCell>{exam.grade || "—"}</TableCell>
                  <TableCell>
                    <div className="no-print flex justify-end gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/exams/${exam.id}`}>
                          <EyeIcon />
                          عرض
                        </Link>
                      </Button>
                      {exam.canModify && (
                        <ConfirmDialog
                          title="حذف هذا الاختبار؟"
                          description={`اختبار ${EXAM_TYPE_LABELS[exam.type]} للطالب «${exam.studentName}» بتاريخ ${exam.date}. لا يمكن التراجع عن الحذف.`}
                          confirmLabel="حذف"
                          destructive
                          onConfirm={() => remove.execute({ id: exam.id })}
                        >
                          <Button variant="ghost" size="icon-sm" aria-label={`حذف اختبار ${exam.studentName}`} disabled={remove.pending}>
                            <Trash2Icon className="text-destructive" />
                          </Button>
                        </ConfirmDialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
