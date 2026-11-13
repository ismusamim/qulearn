"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import { CURRENCY_LABEL } from "@/lib/constants";
import { computeFeeDue } from "@/lib/domain/fees";
import { formatMoney } from "@/lib/format";

import { setStudentFeeAction } from "../actions";
import type { FeeOptions, StudentRowDTO } from "../queries";
import { type StudentFeeData, type StudentFeeInput, studentFeeSchema } from "../schemas";
import { discountLabel } from "../student-rules";

const toNumber = (value: string | number): number | null => {
  const n = Number(value);
  return String(value).trim() === "" || !Number.isFinite(n) ? null : n;
};

/** «فئة واشتراك»: the student's fee category, discount and — optionally — an amount of their own. */
export function StudentFeeDialog({
  student,
  options,
  onClose,
}: {
  student: StudentRowDTO;
  options: FeeOptions;
  onClose: () => void;
}) {
  const fee = student.fee;
  const form = useForm<StudentFeeInput, unknown, StudentFeeData>({
    resolver: zodResolver(studentFeeSchema),
    defaultValues: {
      id: student.id,
      feeCategoryId: fee?.feeCategoryId ?? "",
      feeDiscountId: fee?.feeDiscountId ?? "",
      feeDiscountValue: fee?.feeDiscountValue != null ? String(fee.feeDiscountValue) : "",
      feeDiscountType: fee?.feeDiscountType ?? "PERCENT",
      monthlyFee: fee?.monthlyFee != null ? String(fee.monthlyFee) : "",
    },
  });
  const save = useAction(setStudentFeeAction, { successMessage: "حُفظ", onSuccess: onClose });
  const errors = form.formState.errors;

  // Live preview of what the student will owe with the current choices.
  const values = useWatch({ control: form.control });
  const discountValue = values.feeDiscountId ? toNumber(values.feeDiscountValue ?? "") : null;
  const preview = computeFeeDue(
    {
      category: student.category,
      monthlyFee: toNumber(values.monthlyFee ?? ""),
      feeCategoryId: values.feeCategoryId || null,
      feeDiscountId: values.feeDiscountId || null,
      feeDiscountValue: discountValue,
      feeDiscountType: discountValue == null ? null : (values.feeDiscountType ?? "PERCENT"),
    },
    options.categories,
    options.discounts,
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={form.handleSubmit((data) => save.execute(data))} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>فئة واشتراك: {student.name}</DialogTitle>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="fee-category">الفئة</FieldLabel>
            <NativeSelect id="fee-category" className="w-full" {...form.register("feeCategoryId")}>
              <NativeSelectOption value="">حسب الافتراضي لسنّه</NativeSelectOption>
              {options.categories.map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>
                  {c.name} — {formatMoney(c.amount)} {CURRENCY_LABEL}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {options.categories.length === 0 && (
              <FieldDescription>لم تُضف فئات بعد: أضفها من «الفئات والخصومات».</FieldDescription>
            )}
          </Field>
          <Field>
            <FieldLabel htmlFor="fee-discount">الخصم</FieldLabel>
            <NativeSelect id="fee-discount" className="w-full" {...form.register("feeDiscountId")}>
              <NativeSelectOption value="">بلا خصم</NativeSelectOption>
              {options.discounts.map((d) => (
                <NativeSelectOption key={d.id} value={d.id}>
                  {discountLabel(d)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.feeDiscountValue}>
              <FieldLabel htmlFor="fee-discount-value">قيمة خصم خاصة بهذا الطالب</FieldLabel>
              <Input
                id="fee-discount-value"
                type="number"
                min={0}
                dir="ltr"
                placeholder="فارغ = قيمة الخصم العامة"
                aria-invalid={!!errors.feeDiscountValue}
                {...form.register("feeDiscountValue")}
              />
              <FieldError errors={[errors.feeDiscountValue]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="fee-discount-type">نوعها</FieldLabel>
              <NativeSelect id="fee-discount-type" className="w-full" {...form.register("feeDiscountType")}>
                <NativeSelectOption value="PERCENT">نسبة %</NativeSelectOption>
                <NativeSelectOption value="AMOUNT">مبلغ ({CURRENCY_LABEL})</NativeSelectOption>
              </NativeSelect>
            </Field>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            مطلوبة لـ«حالات خاصة» وكل خصم يُحدَّد لكل طالب؛ واختيارية لغيرها.
          </p>
          <Field data-invalid={!!errors.monthlyFee}>
            <FieldLabel htmlFor="fee-own">مبلغ خاص يتجاوز الفئة (اختياري)</FieldLabel>
            <Input
              id="fee-own"
              type="number"
              min={0}
              dir="ltr"
              placeholder="فارغ = مبلغ الفئة"
              aria-invalid={!!errors.monthlyFee}
              {...form.register("monthlyFee")}
            />
            <FieldError errors={[errors.monthlyFee]} />
          </Field>
          <p className="rounded-lg bg-muted px-3 py-2 text-sm">
            المستحق شهريًا:{" "}
            <b dir="ltr">{preview.due == null ? "—" : formatMoney(preview.due)}</b> {preview.due == null ? "" : CURRENCY_LABEL}
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" disabled={save.pending}>
              {save.pending && <Spinner />}
              حفظ
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
