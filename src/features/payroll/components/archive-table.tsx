import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MONTHS_AR } from "@/lib/dates";

import { formatAmount } from "../constants";
import type { ArchiveYearDTO } from "../reports-service";

const link = "text-primary underline-offset-4 hover:underline";

/** Every year in the ledger; each amount opens that month's sheet. */
export function ArchiveTable({ years }: { years: ArchiveYearDTO[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>أرشيف السنوات</CardTitle>
        <CardDescription>
          كل السنوات محفوظة في نفس السجل. اضغط على أي مبلغ لفتح كشف ذلك الشهر، أو على السنة لملخصها.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {years.length === 0 ? (
          <EmptyState title="لا توجد سنوات مؤرشفة بعد." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>السنة</TableHead>
                {MONTHS_AR.map((name, i) => (
                  <TableHead key={name} className="text-center" title={name}>
                    شهر {i + 1}
                  </TableHead>
                ))}
                <TableHead className="text-center">الإجمالي</TableHead>
                <TableHead className="text-center">أشهر</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {years.map((y) => (
                <TableRow key={y.year}>
                  <TableCell>
                    <Link href={`/payroll?tab=year&y=${y.year}`} className={`${link} font-bold`} dir="ltr">
                      {y.year}
                    </Link>
                  </TableCell>
                  {y.months.map((cell, i) => (
                    <TableCell key={i} className="text-center tabular-nums">
                      {cell ? (
                        <>
                          <Link href={`/payroll?tab=month&y=${y.year}&m=${i + 1}`} className={link} dir="ltr">
                            {formatAmount(cell.total)}
                          </Link>
                          {!cell.closed && <div className="text-xs text-muted-foreground">(مفتوح)</div>}
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="text-center font-bold tabular-nums text-primary" dir="ltr">
                    {formatAmount(y.total)}
                  </TableCell>
                  <TableCell className="text-center">{y.monthCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
