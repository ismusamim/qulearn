"use client";

import { type ReactNode, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, type UseFormReturn, useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import { PLACE_TYPE_LABELS } from "@/lib/constants";
import { scheduleText } from "@/lib/domain/halaqa";

import { createHalaqaAction, updateHalaqaAction } from "../actions";
import { type HalaqaInput, halaqaSchema } from "../schemas";
import { scheduleToInput, scheduleToModel } from "../schedule";
import type { HalaqaDTO, HalaqaFormOptions } from "../service";
import { ScheduleFields } from "./schedule-fields";

export interface PlaceChoice {
  id: string;
  name: string;
  type: "MOSQUE" | "DAR";
}

/** Radix Select cannot hold an empty value, so «بدون» travels as this sentinel inside the UI only. */
const NONE = "none";

function defaultsFor(halaqa: HalaqaDTO | undefined, presetPlaceId: string | undefined): HalaqaInput {
  return {
    placeId: halaqa?.placeId ?? presetPlaceId ?? "",
    teacherId: halaqa?.teacherId ?? "",
    supervisorId: halaqa?.supervisorId ?? "",
    // The fallback name is only offered for a teacherless halaqa that already has one.
    ...(halaqa && !halaqa.teacherId && halaqa.name ? { name: halaqa.name } : {}),
    ...scheduleToInput(halaqa),
  } as HalaqaInput;
}

function MemberSelect({
  form,
  name,
  id,
  options,
}: {
  form: UseFormReturn<HalaqaInput>;
  name: "teacherId" | "supervisorId";
  id: string;
  options: HalaqaFormOptions["teachers"];
}) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <Select value={field.value || NONE} onValueChange={(value) => field.onChange(value === NONE ? "" : value)}>
          <SelectTrigger id={id} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>— بدون —</SelectItem>
            {options.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {member.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
}

/** «حلقة الشيخ أحمد — من بعد صلاة العصر إلى صلاة المغرب», live while the form changes. */
function Preview({ form, teachers }: { form: UseFormReturn<HalaqaInput>; teachers: HalaqaFormOptions["teachers"] }) {
  const values = useWatch({ control: form.control });
  const teacher = teachers.find((t) => t.id === values.teacherId);
  const schedule = scheduleText(
    scheduleToModel({
      mode: values.mode ?? "PRAYER",
      from: values.from ?? "",
      to: values.to ?? "",
      fromPrayer: values.fromPrayer ?? "",
      toKind: values.toKind ?? "prayer",
      toPrayer: values.toPrayer ?? "",
      toTime: values.toTime ?? "",
    }),
  );
  return (
    <p className="rounded-lg bg-muted px-3 py-2 text-sm">
      <b>{teacher ? `حلقة ${teacher.name}` : values.name || "حلقة بلا معلم"}</b>
      <span className="text-muted-foreground"> — {schedule || "حدّد الوقت"}</span>
    </p>
  );
}

/** Create (no `halaqa`) or edit a halaqa. `children` is the button that opens the dialog. */
export function HalaqaFormDialog({
  halaqa,
  presetPlaceId,
  places,
  options,
  children,
}: {
  halaqa?: HalaqaDTO;
  /** Pre-selects the place for «حلقة هنا». */
  presetPlaceId?: string;
  places: PlaceChoice[];
  options: HalaqaFormOptions;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<HalaqaInput>({
    resolver: zodResolver(halaqaSchema),
    defaultValues: defaultsFor(halaqa, presetPlaceId),
  });
  const errors = form.formState.errors;
  const showName = !!halaqa && !halaqa.teacherId && !!halaqa.name;

  // Start from the saved values every time the dialog opens (they change after an edit elsewhere).
  const onOpenChange = (next: boolean) => {
    if (next) form.reset(defaultsFor(halaqa, presetPlaceId));
    setOpen(next);
  };
  const onSuccess = () => setOpen(false);
  const create = useAction(createHalaqaAction, { successMessage: "تم حفظ الحلقة", onSuccess });
  const update = useAction(updateHalaqaAction, { successMessage: "تم حفظ الحلقة", onSuccess });
  const pending = create.pending || update.pending;

  const submit = form.handleSubmit((values) =>
    halaqa ? update.execute({ ...values, id: halaqa.id }) : create.execute(values),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{halaqa ? "تعديل الحلقة" : "حلقة جديدة"}</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={!!errors.placeId}>
              <FieldLabel htmlFor="halaqa-place">المكان</FieldLabel>
              <Controller
                control={form.control}
                name="placeId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="halaqa-place" className="w-full" aria-invalid={!!errors.placeId}>
                      <SelectValue placeholder="— اختر المكان —" />
                    </SelectTrigger>
                    <SelectContent>
                      {places.map((place) => (
                        <SelectItem key={place.id} value={place.id}>
                          {place.name} ({PLACE_TYPE_LABELS[place.type]})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={[errors.placeId]} />
            </Field>
            <Field data-invalid={!!errors.teacherId}>
              <FieldLabel htmlFor="halaqa-teacher">المعلم</FieldLabel>
              <MemberSelect form={form} name="teacherId" id="halaqa-teacher" options={options.teachers} />
              <FieldDescription>الحلقة تُسمّى باسمه.</FieldDescription>
              <FieldError errors={[errors.teacherId]} />
            </Field>
            <Field data-invalid={!!errors.supervisorId}>
              <FieldLabel htmlFor="halaqa-supervisor">المشرف</FieldLabel>
              <MemberSelect form={form} name="supervisorId" id="halaqa-supervisor" options={options.supervisors} />
              <FieldError errors={[errors.supervisorId]} />
            </Field>
            <ScheduleFields form={form} />
            {showName && (
              <Field>
                <FieldLabel htmlFor="halaqa-name">اسم مؤقت</FieldLabel>
                <Input id="halaqa-name" {...form.register("name")} />
                <FieldDescription>يُستبدل باسم المعلم عند اختياره.</FieldDescription>
              </Field>
            )}
            <Preview form={form} teachers={options.teachers} />
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
