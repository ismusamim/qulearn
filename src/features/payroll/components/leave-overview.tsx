import Link from "next/link";

import { PlusIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PERMISSION_LABELS, PROOF_LABELS } from "@/features/absences/constants";
import { weekdayName } from "@/lib/dates";

import type { LeaveOverviewDTO } from "../reports-service";
import { PeriodSelect } from "./period-select";

/** The year's teacher absences and each employee's remaining leave. Recording happens in «غياب المعلمين». */
export function LeaveOverview({ overview, years }: { overview: LeaveOverviewDTO; years: number[] }) {
  const { year, month, absences, balances } = overview;
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <PeriodSelect years={years} year={year} month={month} allMonths monthParam="am" />
            <span className="grow" />
            <Badge variant="secondary">{absences.length} يوم</Badge>
            <Button asChild size="sm" className="no-print">
              <Link href="/absences">
                <PlusIcon />
                تسجيل غياب
              </Link>
            </Button>
          </div>
          {absences.length === 0 ? (
            <EmptyState title="لا يوجد غياب مسجل في هذه الفترة." />
          ) : (
            <div className="max-h-[420px] overflow-y-auto print:max-h-none">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>شهر المرتب</TableHead>
                    <TableHead>الاسم</TableHead>
                    <TableHead>المكان</TableHead>
                    <TableHead>الإذن</TableHead>
                    <TableHead>السبب</TableHead>
                    <TableHead>الإثبات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {absences.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="whitespace-nowrap">
                        <span dir="ltr">{a.date}</span> <span className="text-xs text-muted-foreground">{weekdayName(a.date)}</span>
                      </TableCell>
                      <TableCell>{a.month}</TableCell>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell>{a.place || "—"}</TableCell>
                      <TableCell>{a.permission ? PERMISSION_LABELS[a.permission] : "—"}</TableCell>
                      <TableCell>{a.reason || "—"}</TableCell>
                      <TableCell>{a.proof ? PROOF_LABELS[a.proof] : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            رصيد الإجازات — <span dir="ltr">{year}</span>
          </CardTitle>
          <CardDescription>يُخصم من الرصيد كل يوم غياب إثباته «رصيد»؛ اليوم «المثبت» لا يُخصم.</CardDescription>
        </CardHeader>
        <CardContent>
          {balances.length === 0 ? (
            <EmptyState title="لا يوجد موظفون." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>نظام العمل</TableHead>
                  <TableHead className="text-center">الرصيد</TableHead>
                  <TableHead className="text-center">المخصوم</TableHead>
                  <TableHead className="text-center">المتبقي</TableHead>
                  <TableHead className="text-center">مثبت</TableHead>
                  <TableHead className="text-center">إجمالي الغياب</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {balances.map((b) => (
                  <TableRow key={b.employeeId}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell>{b.workSystem || "—"}</TableCell>
                    <TableCell className="text-center">{b.allowance ?? "—"}</TableCell>
                    <TableCell className="text-center">{b.used}</TableCell>
                    <TableCell
                      className={`text-center font-bold ${b.remaining != null && b.remaining < 0 ? "text-destructive" : "text-primary"}`}
                      dir="ltr"
                    >
                      {b.remaining ?? "—"}
                    </TableCell>
                    <TableCell className="text-center">{b.proven}</TableCell>
                    <TableCell className="text-center">{b.total}</TableCell>
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
