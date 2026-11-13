"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import { GraduationCapIcon, PlusIcon, SearchIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { filterTeachers } from "../profile";
import type { TeacherRowDTO } from "../service";
import { TeacherCreateDialog } from "./teacher-create-dialog";
import { TeacherStatusBadge, TeacherWorkingButton } from "./teacher-status";

export function TeachersTable({ teachers }: { teachers: TeacherRowDTO[] }) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => filterTeachers(teachers, query), [teachers, query]);
  const stopped = useMemo(() => teachers.filter((t) => t.status === "SUSPENDED"), [teachers]);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>المعلمون ({teachers.length})</CardTitle>
          <CardAction>
            <TeacherCreateDialog>
              <Button size="sm">
                <PlusIcon />
                معلم
              </Button>
            </TeacherCreateDialog>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {teachers.length === 0 ? (
            <EmptyState icon={GraduationCapIcon} title="لا يوجد معلمون." description="أضف المعلمين لتُسند إليهم الحلقات." />
          ) : (
            <>
              <div className="relative max-w-sm">
                <SearchIcon className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ابحث بالاسم أو الجوال"
                  aria-label="بحث في المعلمين"
                  className="ps-8"
                />
              </div>
              {shown.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">لا توجد نتائج مطابقة.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الاسم</TableHead>
                      <TableHead>الجوال</TableHead>
                      <TableHead>الحلقات</TableHead>
                      <TableHead>الطلاب</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead className="w-0" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shown.map((teacher) => (
                      <TableRow key={teacher.id}>
                        <TableCell className="font-medium">
                          <Link href={`/teachers/${teacher.id}`} className="hover:underline">
                            {teacher.name}
                          </Link>
                        </TableCell>
                        <TableCell dir="ltr" className="text-end text-muted-foreground">
                          {teacher.phone || "—"}
                        </TableCell>
                        <TableCell>
                          {teacher.halaqat.length === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {teacher.halaqat.map((h) => (
                                <Badge key={h.id} variant="outline">
                                  {h.label}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{teacher.studentCount}</TableCell>
                        <TableCell>
                          <TeacherStatusBadge status={teacher.status} />
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button asChild variant="outline" size="sm">
                              <Link href={`/teachers/${teacher.id}`}>تعديل بيانات</Link>
                            </Button>
                            <TeacherWorkingButton teacher={teacher} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>المتوقفون ({stopped.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {stopped.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا يوجد متوقفون.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>الاسم</TableHead>
                  <TableHead>الحلقات</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {stopped.map((teacher, index) => (
                  <TableRow key={teacher.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="font-medium">{teacher.name}</TableCell>
                    <TableCell>{teacher.halaqat.length}</TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <TeacherWorkingButton teacher={teacher} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
