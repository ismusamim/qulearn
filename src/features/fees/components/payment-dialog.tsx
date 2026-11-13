"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import { CURRENCY_LABEL } from "@/lib/constants";
import { todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/format";

import { recordPaymentAction } from "../actions";
import { monthLabel, parseMonthKey, type YearMonth } from "../months";
import { paymentSchema } from "../schemas";
import type { FeeRowDTO } from "../service";

const formSchema = paymentSchema.pick({ amount: true, date: true, note: true }).extend({ month: z.string() });
type FormValues = z.infer<typeof formSchema>;

/** «تسجيل دفعة»: the amount defaults to what the student still owes for the selected month. */
export function PaymentDialog({
  row,
  month,
  months,
  onClose,
}: {
  row: FeeRowDTO;
  month: YearMonth;
  months: ReadonlyArray<{ value: string; label: string }>;
  onClose: () => void;
}) {
  const selected = `${month.year}-${month.month}`;
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: row.remaining || row.due || ("" as unknown as number),
      month: selected,
      date: todayISO(),
      note: "",
    },
  });
  const errors = form.formState.errors;

  const record = useAction(recordPaymentAction, {
    onSuccess: () => {
      // The message names the amount and month, so it is built here rather than passed as successMessage.
      const values = form.getValues();
      toast.success(
        `سُجّل ${formatMoney(values.amount)} ${CURRENCY_LABEL} لـ«${row.name}» عن ${monthLabel(parseMonthKey(values.month, month))}`,
      );
      onClose();
    },
  });
  const submit = form.handleSubmit((values) => {
    const target = parseMonthKey(values.month, month);
    record.execute({
      studentId: row.studentId,
      year: target.year,
      month: target.month,
      amount: values.amount,
      date: values.date,
      note: values.note,
    });
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>تحصيل اشتراك: {row.name}</DialogTitle>
            {row.due != null && (
              <DialogDescription>
                المستحق <span dir="ltr">{formatMoney(row.due)}</span> — المدفوع <span dir="ltr">{formatMoney(row.paid)}</span> —
                الباقي <span dir="ltr">{formatMoney(row.remaining)}</span> {CURRENCY_LABEL}
              </DialogDescription>
            )}
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={!!errors.amount}>
              <FieldLabel htmlFor="pay-amount">المبلغ ({CURRENCY_LABEL})</FieldLabel>
              <Input
                id="pay-amount"
                type="number"
                min={0}
                step="any"
                dir="ltr"
                aria-invalid={!!errors.amount}
                {...form.register("amount", { valueAsNumber: true })}
              />
              <FieldError errors={[errors.amount]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="pay-month">عن شهر</FieldLabel>
              <NativeSelect id="pay-month" className="w-full" {...form.register("month")}>
                {months.map((m) => (
                  <NativeSelectOption key={m.value} value={m.value}>
                    {m.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field data-invalid={!!errors.date}>
              <FieldLabel htmlFor="pay-date">تاريخ التحصيل</FieldLabel>
              <Input id="pay-date" type="date" dir="ltr" aria-invalid={!!errors.date} {...form.register("date")} />
              <FieldError errors={[errors.date]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="pay-note">ملاحظة (اختياري)</FieldLabel>
              <Input id="pay-note" maxLength={300} {...form.register("note")} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" disabled={record.pending}>
              {record.pending && <Spinner />}
              حفظ
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
