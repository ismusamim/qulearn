"use client";

import { Trash2Icon } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAction } from "@/hooks/use-action";
import { CURRENCY_LABEL } from "@/lib/constants";
import { monthName } from "@/lib/dates";
import { formatMoney } from "@/lib/format";

import { deletePaymentAction } from "../actions";
import type { PaymentDTO } from "../service";

/** «السجل»: every payment of one student. `payments` is null while loading. */
export function HistoryDialog({
  studentName,
  payments,
  onChanged,
  onClose,
}: {
  studentName: string;
  payments: PaymentDTO[] | null;
  /** Called after a payment is deleted, to reload the list. */
  onChanged: () => void;
  onClose: () => void;
}) {
  const remove = useAction(deletePaymentAction, { successMessage: "حُذفت الدفعة", onSuccess: onChanged });
  const total = (payments ?? []).reduce((sum, p) => sum + p.amount, 0);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>سجل اشتراكات: {studentName}</DialogTitle>
        </DialogHeader>
        {payments === null ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : payments.length === 0 ? (
          <EmptyState title="لا توجد دفعات مسجّلة لهذا الطالب" />
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>عن شهر</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>حصّلها</TableHead>
                  <TableHead>ملاحظة</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {monthName(p.month)} <span dir="ltr">{p.year}</span>
                    </TableCell>
                    <TableCell dir="ltr" className="text-end">
                      {formatMoney(p.amount)}
                    </TableCell>
                    <TableCell dir="ltr" className="text-end">
                      {p.date ?? ""}
                    </TableCell>
                    <TableCell>{p.collectedByName}</TableCell>
                    <TableCell className="whitespace-normal text-muted-foreground">{p.note}</TableCell>
                    <TableCell>
                      {p.canDelete && (
                        <ConfirmDialog
                          title={`حذف دفعة ${formatMoney(p.amount)} ${CURRENCY_LABEL} عن ${monthName(p.month)} ${p.year}؟`}
                          description="لا يمكن التراجع عن الحذف."
                          confirmLabel="حذف"
                          destructive
                          onConfirm={() => remove.execute({ id: p.id })}
                        >
                          <Button variant="ghost" size="icon-sm" aria-label="حذف الدفعة" disabled={remove.pending}>
                            <Trash2Icon className="text-destructive" />
                          </Button>
                        </ConfirmDialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>الإجمالي</TableCell>
                  <TableCell dir="ltr" className="text-end">
                    {formatMoney(total)}
                  </TableCell>
                  <TableCell colSpan={4} />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
