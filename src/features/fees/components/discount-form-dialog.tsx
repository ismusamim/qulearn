"use client";

import { type ReactNode, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import { CURRENCY_LABEL } from "@/lib/constants";

import { createDiscountAction, updateDiscountAction } from "../actions";
import type { FeeDiscountDTO } from "../config-service";
import { type DiscountInput, discountSchema } from "../schemas";

/** Create (no `discount`) or edit a discount. */
export function DiscountFormDialog({ discount, children }: { discount?: FeeDiscountDTO; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const form = useForm<DiscountInput>({
    resolver: zodResolver(discountSchema),
    defaultValues: {
      name: discount?.name ?? "",
      type: discount?.type ?? "PERCENT",
      value: discount?.value ?? ("" as unknown as number),
      perStudent: discount?.perStudent ?? false,
    },
  });
  const errors = form.formState.errors;
  const perStudent = useWatch({ control: form.control, name: "perStudent" });

  const onSuccess = () => {
    setOpen(false);
    if (!discount) form.reset();
  };
  const create = useAction(createDiscountAction, { successMessage: "تمت إضافة الخصم", onSuccess });
  const update = useAction(updateDiscountAction, { successMessage: "تم حفظ التعديلات", onSuccess });
  const pending = create.pending || update.pending;

  const submit = form.handleSubmit((values) =>
    discount ? update.execute({ ...values, id: discount.id }) : create.execute(values),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{discount ? `تعديل: ${discount.name}` : "خصم جديد"}</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="disc-name">اسم الخصم</FieldLabel>
              <Input id="disc-name" aria-invalid={!!errors.name} {...form.register("name")} />
              <FieldError errors={[errors.name]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="disc-type">النوع</FieldLabel>
              <NativeSelect id="disc-type" className="w-full" {...form.register("type")}>
                <NativeSelectOption value="PERCENT">نسبة %</NativeSelectOption>
                <NativeSelectOption value="AMOUNT">مبلغ ثابت ({CURRENCY_LABEL})</NativeSelectOption>
              </NativeSelect>
            </Field>
            <Field orientation="horizontal">
              <Controller
                control={form.control}
                name="perStudent"
                render={({ field }) => (
                  <Checkbox
                    id="disc-each"
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      field.onChange(checked === true);
                      // A per-student discount has no general value.
                      if (checked === true) form.setValue("value", 0, { shouldValidate: true });
                    }}
                  />
                )}
              />
              <FieldLabel htmlFor="disc-each">تُحدَّد القيمة لكل طالب</FieldLabel>
            </Field>
            {!perStudent && (
              <Field data-invalid={!!errors.value}>
                <FieldLabel htmlFor="disc-value">القيمة</FieldLabel>
                <Input
                  id="disc-value"
                  type="number"
                  min={0}
                  step="any"
                  dir="ltr"
                  aria-invalid={!!errors.value}
                  {...form.register("value", { valueAsNumber: true })}
                />
                <FieldError errors={[errors.value]} />
              </Field>
            )}
            <FieldDescription>
              «لكل طالب»: لا قيمة عامة للخصم، وتُحدَّد قيمته ونوعه لكل طالب من زر «قيمة الاشتراك» (مثل الحالات الخاصة). خصم
              100% يجعل الطالب معفى.
            </FieldDescription>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
