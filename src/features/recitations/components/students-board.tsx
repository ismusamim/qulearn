"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import { BookOpenIcon, SearchIcon, UsersIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRate } from "@/features/attendance/stats";
import { normalizeArabic } from "@/lib/arabic";
import { cn } from "@/lib/utils";

import { lastHifzText } from "../progress";
import type { StudentRowDTO } from "../service";
import { RecitationDialog } from "./recitation-dialog";

/** The teacher's students with a quick «تسجيل تسميع» per row. Search is local to the loaded list. */
export function StudentsBoard({ students, showHalaqa }: { students: StudentRowDTO[]; showHalaqa: boolean }) {
  const [query, setQuery] = useState("");
  const [recording, setRecording] = useState<StudentRowDTO | null>(null);

  const visible = useMemo(() => {
    const q = normalizeArabic(query);
    return q ? students.filter((s) => normalizeArabic(s.name).includes(q)) : students;
  }, [students, query]);
  const droppedCount = students.filter((s) => s.dropped).length;

  if (students.length === 0) return <EmptyState icon={UsersIcon} title="لا يوجد طلاب في هذه الحلقة." />;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="no-print flex flex-wrap items-center gap-3">
          <InputGroup className="max-w-xs">
            <InputGroupInput
              type="search"
              placeholder="ابحث باسم الطالب…"
              aria-label="بحث"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
          </InputGroup>
          <span className="text-sm text-muted-foreground">
            {students.length - droppedCount} طالب{droppedCount > 0 && ` · ${droppedCount} منقطع`}
          </span>
        </div>
        {visible.length === 0 ? (
          <EmptyState icon={SearchIcon} title="لا يوجد طالب بهذا الاسم" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الطالب</TableHead>
                {showHalaqa && <TableHead>الحلقة</TableHead>}
                <TableHead>آخر حفظ</TableHead>
                <TableHead>التسميعات</TableHead>
                <TableHead>الحضور</TableHead>
                <TableHead className="no-print w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((student) => (
                <TableRow key={student.id} className={cn(student.dropped && "text-muted-foreground")}>
                  <TableCell className="font-medium">
                    <Link href={`/my-students/${student.id}`} className="hover:underline">
                      {student.name}
                    </Link>
                    {student.dropped && (
                      <Badge variant="destructive" className="ms-2">
                        منقطع
                      </Badge>
                    )}
                  </TableCell>
                  {showHalaqa && <TableCell>{student.halaqaLabel}</TableCell>}
                  <TableCell>{lastHifzText(student.lastHifz)}</TableCell>
                  <TableCell>{student.recitationCount}</TableCell>
                  <TableCell>
                    <span dir="ltr">{formatRate(student.attendanceRate)}</span>
                  </TableCell>
                  <TableCell className="no-print">
                    <div className="flex justify-end gap-1">
                      {!student.dropped && (
                        <Button size="sm" onClick={() => setRecording(student)}>
                          <BookOpenIcon />
                          تسجيل تسميع
                        </Button>
                      )}
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/my-students/${student.id}`}>السجل</Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <RecitationDialog student={recording} onClose={() => setRecording(null)} />
    </Card>
  );
}
