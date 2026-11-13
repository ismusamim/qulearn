"use client";

import { type ReactNode, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import { CURRENCY_LABEL } from "@/lib/constants";

import { createCategoryAction, updateCategoryAction } from "../actions";
import type { FeeCategoryDTO } from "../config-service";
import { type CategoryInput, categorySchema } from "../schemas";

/** Create (no `category`) or edit a subscription category. */
export function CategoryFormDialog({ category, children }: { category?: FeeCategoryDTO; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const form = useForm<CategoryInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name ?? "",
      amount: category?.amount ?? ("" as unknown as number),
      defaultFor: category?.defaultFor ?? null,
    },
  });
  const errors = form.formState.errors;

  const onSuccess = () => {
    setOpen(false);
    if (!category) form.reset();
  };
  const create = useAction(createCategoryAction, { successMessage: "تمت إضافة الفئة", onSuccess });
  const update = useAction(updateCategoryAction, { successMessage: "تم حفظ التعديلات", onSuccess });
  const pending = create.pending || update.pending;

  const submit = form.handleSubmit((values) =>
    category ? update.execute({ ...values, id: category.id }) : create.execute(values),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{category ? `تعديل: ${category.name}` : "فئة جديدة"}</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="cat-name">اسم الفئة</FieldLabel>
              <Input id="cat-name" placeholder="مثال: الصغار" aria-invalid={!!errors.name} {...form.register("name")} />
              <FieldError errors={[errors.name]} />
            </Field>
            <Field data-invalid={!!errors.amount}>
              <FieldLabel htmlFor="cat-amount">المبلغ الشهري ({CURRENCY_LABEL})</FieldLabel>
              <Input
                id="cat-amount"
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
              <FieldLabel htmlFor="cat-default">الافتراضية لـ</FieldLabel>
              <Controller
                control={form.control}
                name="defaultFor"
                render={({ field }) => (
                  <NativeSelect
                    id="cat-default"
                    className="w-full"
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value || null)}
                  >
                    <NativeSelectOption value="">—</NativeSelectOption>
                    <NativeSelectOption value="CHILD">الصغار</NativeSelectOption>
                    <NativeSelectOption value="ADULT">الكبار</NativeSelectOption>
                  </NativeSelect>
                )}
              />
              <FieldDescription>
                تجعل الفئة تُطبَّق تلقائيًا على كل الصغار أو كل الكبار ما لم تُعيَّن لهم فئة أخرى.
              </FieldDescription>
            </Field>
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
