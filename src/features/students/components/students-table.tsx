"use client";

import { useState } from "react";

import Link from "next/link";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAction } from "@/hooks/use-action";
import { STUDENT_CATEGORY_LABELS, STUDENT_STATUS_LABELS } from "@/lib/constants";
import { initialOf } from "@/lib/format";

import { setStudentStatusAction } from "../actions";
import type { FeeOptions, HalaqaChoice, StudentCaps, StudentRowDTO } from "../queries";
import { DeleteStudentDialog } from "./delete-student-dialog";
import { MoveStudentDialog } from "./move-student-dialog";
import { StudentFeeDialog } from "./student-fee-dialog";

type OpenDialog = { kind: "move" | "fee" | "delete"; student: StudentRowDTO } | null;

export function StudentsTable({
  rows,
  offset,
  caps,
  halaqat,
  feeOptions,
}: {
  rows: StudentRowDTO[];
  /** Number of students on earlier pages, for the running row number. */
  offset: number;
  caps: StudentCaps;
  halaqat: HalaqaChoice[];
  /** Present only for holders of fees.amount. */
  feeOptions: FeeOptions | null;
}) {
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const close = () => setDialog(null);
  const activate = useAction(setStudentStatusAction, { successMessage: "أصبح منتظمًا" });
  const drop = useAction(setStudentStatusAction, { successMessage: "سُجّل منقطعًا" });
  const statusPending = activate.pending || drop.pending;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-0">#</TableHead>
            <TableHead>الطالب</TableHead>
            <TableHead>الفئة</TableHead>
            <TableHead>السن</TableHead>
            <TableHead>الحلقة</TableHead>
            <TableHead>المكان</TableHead>
            <TableHead>الحالة</TableHead>
            {caps.stats && <TableHead>آخر حفظ</TableHead>}
            {caps.stats && <TableHead>الحضور</TableHead>}
            <TableHead className="no-print w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((s, i) => {
            const dropped = s.status === "DROPPED";
            return (
              <TableRow key={s.id}>
                <TableCell className="text-muted-foreground" dir="ltr">
                  {offset + i + 1}
                </TableCell>
                <TableCell>
                  <Link href={`/students/${s.id}`} className="flex items-center gap-2 font-medium hover:text-primary">
                    <Avatar>
                      {s.photo && <AvatarImage src={s.photo} alt="" />}
                      <AvatarFallback>{initialOf(s.name)}</AvatarFallback>
                    </Avatar>
                    {s.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={s.category === "ADULT" ? "outline" : "secondary"}>{STUDENT_CATEGORY_LABELS[s.category]}</Badge>
                </TableCell>
                <TableCell dir="ltr" className="text-end">
                  {s.age ?? "—"}
                </TableCell>
                <TableCell>{s.halaqaLabel ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>{s.placeName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>
                  {dropped ? (
                    <span className="flex items-center gap-1.5">
                      <Badge variant="destructive">{STUDENT_STATUS_LABELS.DROPPED}</Badge>
                      {s.statusDate && (
                        <small dir="ltr" className="text-muted-foreground">
                          {s.statusDate}
                        </small>
                      )}
                    </span>
                  ) : (
                    <Badge className="bg-success/15 text-success">{STUDENT_STATUS_LABELS.ACTIVE}</Badge>
                  )}
                </TableCell>
                {caps.stats && <TableCell>{s.lastHifz ?? "—"}</TableCell>}
                {caps.stats && <TableCell dir="ltr" className="text-end">{s.attendance ?? "—"}</TableCell>}
                <TableCell className="no-print">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" asChild>
                      <Link href={`/students/${s.id}`}>الملف</Link>
                    </Button>
                    {caps.edit && (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/students/${s.id}/edit`}>تعديل</Link>
                      </Button>
                    )}
                    {caps.move && (
                      <Button size="sm" variant="outline" onClick={() => setDialog({ kind: "move", student: s })}>
                        نقل
                      </Button>
                    )}
                    {caps.status && (
                      <ConfirmDialog
                        title={dropped ? `إعادة «${s.name}» منتظمًا؟` : `تسجيل «${s.name}» منقطعًا؟`}
                        description={
                          dropped
                            ? "يعود إلى الاشتراكات المتوقعة ويستطيع استخدام حسابه من جديد."
                            : "لن يُحسب في الاشتراكات المتوقعة، ويُوقَف حسابه: يدخل فيرى تنبيهًا فقط ولا يستطيع تسجيل أي شيء حتى يعود منتظمًا."
                        }
                        confirmLabel={dropped ? "منتظم" : "منقطع"}
                        destructive={!dropped}
                        onConfirm={() =>
                          dropped ? activate.execute({ id: s.id, status: "ACTIVE" }) : drop.execute({ id: s.id, status: "DROPPED" })
                        }
                      >
                        <Button size="sm" variant="outline" disabled={statusPending}>
                          {dropped ? "منتظم" : "منقطع"}
                        </Button>
                      </ConfirmDialog>
                    )}
                    {caps.fee && feeOptions && (
                      <Button size="sm" variant="outline" onClick={() => setDialog({ kind: "fee", student: s })}>
                        الاشتراك
                      </Button>
                    )}
                    {caps.remove && (
                      <Button size="sm" variant="destructive" onClick={() => setDialog({ kind: "delete", student: s })}>
                        حذف
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {dialog?.kind === "move" && <MoveStudentDialog key={dialog.student.id} student={dialog.student} halaqat={halaqat} onClose={close} />}
      {dialog?.kind === "fee" && feeOptions && (
        <StudentFeeDialog key={dialog.student.id} student={dialog.student} options={feeOptions} onClose={close} />
      )}
      {dialog?.kind === "delete" && <DeleteStudentDialog key={dialog.student.id} student={dialog.student} onClose={close} />}
    </>
  );
}
