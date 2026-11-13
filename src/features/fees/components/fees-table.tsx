"use client";

import { useState } from "react";

import { BanknoteIcon, HistoryIcon, TagIcon, UsersIcon, WalletIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAction } from "@/hooks/use-action";
import { formatMoney } from "@/lib/format";

import { listStudentPaymentsAction } from "../actions";
import type { FeeConfigDTO } from "../config-service";
import type { YearMonth } from "../months";
import type { FeeFiltersInput } from "../schemas";
import type { FeeRowDTO, FeesOverviewDTO, PaymentDTO } from "../service";
import { FeeStateBadge } from "./fee-state-badge";
import { HistoryDialog } from "./history-dialog";
import { PaymentDialog } from "./payment-dialog";
import { StudentFeeDialog } from "./student-fee-dialog";

type Open = { kind: "pay" | "history" | "assign"; row: FeeRowDTO } | { kind: "bulk" } | null;

export function FeesTable({
  overview,
  config,
  month,
  months,
  filters,
}: {
  overview: FeesOverviewDTO;
  config: FeeConfigDTO;
  month: YearMonth;
  /** Months a payment may be recorded for. */
  months: ReadonlyArray<{ value: string; label: string }>;
  filters: FeeFiltersInput;
}) {
  const { rows, total, canCollect, canAssign } = overview;
  // One dialog instance for the whole table instead of three per row.
  const [open, setOpen] = useState<Open>(null);
  const [payments, setPayments] = useState<PaymentDTO[] | null>(null);
  const history = useAction(listStudentPaymentsAction, { onSuccess: setPayments });
  const close = () => setOpen(null);

  const openHistory = (row: FeeRowDTO) => {
    setPayments(null);
    setOpen({ kind: "history", row });
    history.execute({ studentId: row.studentId });
  };
  const searching = !!(filters.qs || filters.qh || filters.qp);

  return (
    <div className="flex flex-col gap-3">
      {canAssign && total > 0 && (
        <div className="no-print flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setOpen({ kind: "bulk" })}>
            <UsersIcon />
            تعيين لنتائج البحث
          </Button>
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState icon={WalletIcon} title={searching ? "لا توجد نتائج مطابقة." : "لا يوجد طلاب بعد."} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>الطالب</TableHead>
              <TableHead>الحلقة</TableHead>
              <TableHead>المكان</TableHead>
              <TableHead>الفئة / الخصم</TableHead>
              <TableHead>المستحق</TableHead>
              {canCollect && (
                <>
                  <TableHead>المدفوع</TableHead>
                  <TableHead>الباقي</TableHead>
                  <TableHead>الحالة</TableHead>
                </>
              )}
              <TableHead className="no-print w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={row.studentId}>
                <TableCell dir="ltr" className="text-end text-muted-foreground">
                  {index + 1}
                </TableCell>
                <TableCell className="font-medium">
                  {row.name}
                  {!canCollect && row.dropped && (
                    <Badge variant="destructive" className="ms-2">
                      منقطع
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{row.halaqaLabel ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>{row.placeName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>
                  {row.sourceLabel ?? <span className="text-muted-foreground">—</span>}
                  {row.discountLabel && (
                    <div>
                      <Badge variant="secondary">{row.discountLabel}</Badge>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {row.due == null ? (
                    "—"
                  ) : (
                    <span className="inline-flex items-baseline gap-1.5">
                      <span dir="ltr" className="font-medium">
                        {formatMoney(row.due)}
                      </span>
                      {row.discount > 0 && row.base != null && (
                        <s dir="ltr" className="text-xs text-muted-foreground">
                          {formatMoney(row.base)}
                        </s>
                      )}
                    </span>
                  )}
                </TableCell>
                {canCollect && (
                  <>
                    <TableCell dir="ltr" className="text-end">
                      {row.paid ? formatMoney(row.paid) : "—"}
                    </TableCell>
                    <TableCell dir="ltr" className="text-end">
                      {row.due ? formatMoney(row.remaining) : "—"}
                    </TableCell>
                    <TableCell>
                      <FeeStateBadge state={row.state} paid={row.paid} remaining={row.remaining} />
                    </TableCell>
                  </>
                )}
                <TableCell className="no-print">
                  <div className="flex justify-end gap-1">
                    {canCollect && (
                      <>
                        {/* An exempt student (due 0) has nothing to pay. */}
                        <Button size="sm" disabled={row.due === 0} onClick={() => setOpen({ kind: "pay", row })}>
                          <BanknoteIcon />
                          تسجيل دفعة
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openHistory(row)}>
                          <HistoryIcon />
                          السجل
                        </Button>
                      </>
                    )}
                    {canAssign && (
                      <Button variant="outline" size="sm" onClick={() => setOpen({ kind: "assign", row })}>
                        <TagIcon />
                        قيمة الاشتراك
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {total > rows.length && (
        <p className="text-sm text-muted-foreground">
          يظهر أول {rows.length} من {total} طالبًا؛ اكتب في مربعات البحث للتضييق.
        </p>
      )}

      {open?.kind === "pay" && <PaymentDialog row={open.row} month={month} months={months} onClose={close} />}
      {open?.kind === "history" && (
        <HistoryDialog
          studentName={open.row.name}
          payments={payments}
          onChanged={() => history.execute({ studentId: open.row.studentId })}
          onClose={close}
        />
      )}
      {open?.kind === "assign" && <StudentFeeDialog target={{ kind: "one", row: open.row }} config={config} onClose={close} />}
      {open?.kind === "bulk" && <StudentFeeDialog target={{ kind: "bulk", count: total, filters }} config={config} onClose={close} />}
    </div>
  );
}
