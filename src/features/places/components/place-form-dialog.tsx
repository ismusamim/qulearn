"use client";

import { type ReactNode, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import { PLACE_TYPE_LABELS } from "@/lib/constants";

import { createPlaceAction, updatePlaceAction } from "../actions";
import { type PlaceInput, placeSchema } from "../schemas";
import type { PlaceDTO } from "../service";

/** Create (no `place`) or edit a place. `children` is the button that opens the dialog. */
export function PlaceFormDialog({ place, children }: { place?: PlaceDTO; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const form = useForm<PlaceInput>({
    resolver: zodResolver(placeSchema),
    defaultValues: { name: place?.name ?? "", type: place?.type ?? "MOSQUE", address: place?.address ?? "" },
  });

  const onSuccess = () => {
    setOpen(false);
    if (!place) form.reset();
  };
  const create = useAction(createPlaceAction, { successMessage: "تمت إضافة المكان", onSuccess });
  const update = useAction(updatePlaceAction, { successMessage: "تم حفظ التعديلات", onSuccess });
  const pending = create.pending || update.pending;

  const submit = form.handleSubmit((values) =>
    place ? update.execute({ ...values, id: place.id }) : create.execute(values),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{place ? `تعديل: ${place.name}` : "مكان جديد"}</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={!!form.formState.errors.name}>
              <FieldLabel htmlFor="place-name">اسم المكان</FieldLabel>
              <Input id="place-name" {...form.register("name")} aria-invalid={!!form.formState.errors.name} />
              <FieldError errors={[form.formState.errors.name]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="place-type">النوع</FieldLabel>
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="place-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PLACE_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="place-address">العنوان</FieldLabel>
              <Input id="place-address" {...form.register("address")} />
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
