"use client";

import { useState } from "react";

import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import { CURRENCY_LABEL } from "@/lib/constants";
import { formatMoney } from "@/lib/format";

import { bulkSetStudentFeeAction, setStudentFeeAction } from "../actions";
import type { FeeConfigDTO, FeeDiscountDTO } from "../config-service";
import type { FeeFiltersInput } from "../schemas";
import type { FeeRowDTO } from "../service";
import { discountText } from "../summary";

const KEEP = "keep";

const discountLabel = (d: FeeDiscountDTO) =>
  d.perStudent ? `${d.name} (يُحدَّد لكل طالب)` : `${d.name} (${discountText(d.type, d.value, formatMoney, CURRENCY_LABEL)})`;

/** Empty box → null; otherwise the number typed (NaN when it is not one). */
const toNumber = (text: string): number | null => (text.trim() === "" ? null : Number(text));

/**
 * «قيمة اشتراك الطالب»: category, discount, the student's own discount value and
 * own amount. With `bulk` it applies to every student matching the search, and
 * «بلا تغيير» leaves a field as each student has it.
 */
export function StudentFeeDialog({
  target,
  config,
  onClose,
}: {
  target: { kind: "one"; row: FeeRowDTO } | { kind: "bulk"; count: number; filters: FeeFiltersInput };
  config: FeeConfigDTO;
  onClose: () => void;
}) {
  const one = target.kind === "one" ? target.row : null;
  const [category, setCategory] = useState(one ? (one.fee.feeCategoryId ?? "") : KEEP);
  const [discount, setDiscount] = useState(one ? (one.fee.feeDiscountId ?? "") : KEEP);
  const [ownValue, setOwnValue] = useState(one?.fee.feeDiscountValue != null ? String(one.fee.feeDiscountValue) : "");
  const [ownType, setOwnType] = useState<"PERCENT" | "AMOUNT">(one?.fee.feeDiscountType ?? "PERCENT");
  const [fee, setFee] = useState(one?.fee.monthlyFee != null ? String(one.fee.monthlyFee) : "");

  const saveOne = useAction(setStudentFeeAction, { successMessage: "حُفظ", onSuccess: onClose });
  const saveBulk = useAction(bulkSetStudentFeeAction, {
    onSuccess: ({ count }) => {
      toast.success(`عُيّن لـ${count} طالبًا`);
      onClose();
    },
  });
  const pending = saveOne.pending || saveBulk.pending;
  const who = one ? "هذا الطالب" : "هؤلاء الطلاب";

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = toNumber(ownValue);
    const picked = config.discounts.find((d) => d.id === discount);
    if (picked?.perStudent && value === null) {
      toast.error(`حدّد قيمة خصم «${picked.name}» ونوعه لـ${who}`);
      return;
    }
    if (value !== null && (!(value >= 0) || (ownType === "PERCENT" && value > 100))) {
      toast.error("قيمة الخصم غير صحيحة");
      return;
    }
    const own = { feeDiscountValue: value, feeDiscountType: ownType };
    if (target.kind === "one") {
      saveOne.execute({
        studentId: target.row.studentId,
        feeCategoryId: category || null,
        feeDiscountId: discount || null,
        ...own,
        monthlyFee: toNumber(fee),
      });
    } else {
      saveBulk.execute({
        filters: target.filters,
        feeCategoryId: category === KEEP ? KEEP : category || null,
        feeDiscountId: discount === KEEP ? KEEP : discount || null,
        ...own,
      });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>
              {target.kind === "one" ? `فئة واشتراك: ${target.row.name}` : `تعيين لـ${target.count} طالبًا من نتائج البحث`}
            </DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="sf-category">الفئة</FieldLabel>
              <NativeSelect id="sf-category" className="w-full" value={category} onChange={(e) => setCategory(e.target.value)}>
                {!one && <NativeSelectOption value={KEEP}>— بلا تغيير —</NativeSelectOption>}
                <NativeSelectOption value="">حسب الافتراضي لسنّه</NativeSelectOption>
                {config.categories.map((c) => (
                  <NativeSelectOption key={c.id} value={c.id}>
                    {c.name} — {formatMoney(c.amount)} {CURRENCY_LABEL}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="sf-discount">الخصم</FieldLabel>
              <NativeSelect id="sf-discount" className="w-full" value={discount} onChange={(e) => setDiscount(e.target.value)}>
                {!one && <NativeSelectOption value={KEEP}>— بلا تغيير —</NativeSelectOption>}
                <NativeSelectOption value="">بلا خصم</NativeSelectOption>
                {config.discounts.map((d) => (
                  <NativeSelectOption key={d.id} value={d.id}>
                    {discountLabel(d)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="sf-own-value">قيمة خصم خاصة بـ{who}</FieldLabel>
                <Input
                  id="sf-own-value"
                  type="number"
                  min={0}
                  step="any"
                  dir="ltr"
                  value={ownValue}
                  onChange={(e) => setOwnValue(e.target.value)}
                  placeholder={one ? "فارغ = قيمة الخصم العامة" : "فارغ = بلا تغيير"}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="sf-own-type">نوعها</FieldLabel>
                <NativeSelect
                  id="sf-own-type"
                  className="w-full"
                  value={ownType}
                  onChange={(e) => setOwnType(e.target.value === "AMOUNT" ? "AMOUNT" : "PERCENT")}
                >
                  <NativeSelectOption value="PERCENT">نسبة %</NativeSelectOption>
                  <NativeSelectOption value="AMOUNT">مبلغ ({CURRENCY_LABEL})</NativeSelectOption>
                </NativeSelect>
              </Field>
            </div>
            <FieldDescription>مطلوبة لـ«حالات خاصة» وكل خصم يُحدَّد لكل طالب؛ واختيارية لغيرها.</FieldDescription>
            {one && (
              <Field>
                <FieldLabel htmlFor="sf-fee">مبلغ خاص يتجاوز الفئة (اختياري)</FieldLabel>
                <Input
                  id="sf-fee"
                  type="number"
                  min={0}
                  step="any"
                  dir="ltr"
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                  placeholder="فارغ = مبلغ الفئة"
                />
              </Field>
            )}
            {config.categories.length === 0 && (
              <Alert>
                <AlertDescription>لم تُضف فئات بعد: أضفها من «الفئات والخصومات».</AlertDescription>
              </Alert>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner />}
              حفظ
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
