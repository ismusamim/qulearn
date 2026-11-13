"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { STUDENT_CATEGORY_LABELS, STUDENT_STATUS_LABELS } from "@/lib/constants";
import { initialOf } from "@/lib/format";

import type { HalaqaStudentsDTO } from "../service";

/**
 * A halaqa's details and students. The page renders it when the URL carries
 * `?h=<id>`; closing it removes that parameter (keeping the filters).
 */
export function HalaqaStudentsDialog({ data }: { data: HalaqaStudentsDTO }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const { halaqa, students, activeCount, droppedCount } = data;

  const close = () => {
    setOpen(false);
    const params = new URLSearchParams(window.location.search);
    params.delete("h");
    const qs = params.toString();
    router.replace(qs ? `/halaqat?${qs}` : "/halaqat", { scroll: false });
  };

  const info: Array<[string, string]> = [
    ["المعلم", halaqa.teacherName ?? "—"],
    ["المشرف", halaqa.supervisorName ?? "—"],
    ["المكان", halaqa.placeName ?? "—"],
    ["الوقت", halaqa.schedule || "—"],
    ["الطلاب", `${activeCount} منتظم${droppedCount ? ` و${droppedCount} منقطع` : ""}`],
  ];

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{halaqa.label}</DialogTitle>
          <DialogDescription>بيانات الحلقة وقائمة طلابها.</DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg bg-muted/60 p-3 sm:grid-cols-[auto_1fr_auto_1fr]">
          {info.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>

        {students.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground">لا يوجد طلاب في هذه الحلقة بعد.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-0">#</TableHead>
                <TableHead>الطالب</TableHead>
                <TableHead>الفئة</TableHead>
                <TableHead>السن</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>الهاتف</TableHead>
                <TableHead>آخر حفظ</TableHead>
                <TableHead>الحضور</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student, index) => (
                <TableRow key={student.id}>
                  <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                  <TableCell>
                    <Link href={`/students/${student.id}`} className="flex items-center gap-2 font-medium hover:underline">
                      <Avatar size="sm">
                        {student.photo && <AvatarImage src={student.photo} alt="" />}
                        <AvatarFallback>{initialOf(student.name)}</AvatarFallback>
                      </Avatar>
                      {student.name}
                    </Link>
                  </TableCell>
                  <TableCell>{STUDENT_CATEGORY_LABELS[student.category]}</TableCell>
                  <TableCell>{student.age ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={student.status === "DROPPED" ? "destructive" : "secondary"}>
                      {STUDENT_STATUS_LABELS[student.status]}
                    </Badge>
                  </TableCell>
                  <TableCell dir="ltr" className="text-start">
                    {student.phone || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{student.lastHifz ?? "—"}</TableCell>
                  <TableCell dir="ltr" className="text-start">
                    {student.attendanceRate === null ? "—" : `${student.attendanceRate}%`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
