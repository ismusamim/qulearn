import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { PrintButton } from "@/components/shared/print-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MONTHS_AR } from "@/lib/dates";

import type { YearSummary } from "../calc";
import { formatAmount } from "../constants";
import { PeriodSelect } from "./period-select";

const num = "text-center tabular-nums";

/** Net salary of every employee in each month of one year. */
export function YearSummaryCard({ year, years, summary }: { year: number; years: number[]; summary: YearSummary }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <PeriodSelect years={years} year={year} />
          <h2 className="hidden text-lg font-bold print:block">ملخص رواتب سنة {year}</h2>
          <span className="grow" />
          <Badge variant="outline">
            إجمالي السنة: <b dir="ltr">{formatAmount(summary.total)}</b>
          </Badge>
          {summary.lines.length > 0 && <PrintButton />}
        </div>
        {summary.lines.length === 0 ? (
          <EmptyState title="لا توجد رواتب مسجلة في هذه السنة." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الكود</TableHead>
                <TableHead>الاسم</TableHead>
                {MONTHS_AR.map((name, i) => (
                  <TableHead key={name} className="text-center">
                    <Link
                      href={`/payroll?tab=month&y=${year}&m=${i + 1}`}
                      className="text-primary underline-offset-4 hover:underline"
                      title={name}
                    >
                      {i + 1}
                    </Link>
                  </TableHead>
                ))}
                <TableHead className="text-center">الإجمالي</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.lines.map((line) => (
                <TableRow key={line.employeeId}>
                  <TableCell dir="ltr" className="text-end">
                    {line.code}
                  </TableCell>
                  <TableCell className="font-medium whitespace-nowrap">{line.name}</TableCell>
                  {line.months.map((net, i) => (
                    <TableCell key={i} className={num} dir="ltr">
                      {formatAmount(net)}
                    </TableCell>
                  ))}
                  <TableCell className={`${num} font-bold text-primary`} dir="ltr">
                    {formatAmount(line.total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="font-bold">
                <TableCell colSpan={2}>الإجمالي</TableCell>
                {summary.monthTotals.map((total, i) => (
                  <TableCell key={i} className={num} dir="ltr">
                    {formatAmount(total)}
                  </TableCell>
                ))}
                <TableCell className={num} dir="ltr">
                  {formatAmount(summary.total)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
