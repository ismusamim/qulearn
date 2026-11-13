"use client";

import { Controller, type UseFormReturn, useWatch } from "react-hook-form";

import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PRAYERS } from "@/lib/constants";

import type { HalaqaInput } from "../schemas";

type Form = UseFormReturn<HalaqaInput>;

function PrayerSelect({ form, name, id }: { form: Form; name: "fromPrayer" | "toPrayer"; id: string }) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <Select value={field.value} onValueChange={field.onChange}>
          <SelectTrigger id={id} className="w-full" aria-invalid={fieldState.invalid}>
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {PRAYERS.map((prayer) => (
              <SelectItem key={prayer} value={prayer}>
                {prayer}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
}

function TimeField({ form, name, label }: { form: Form; name: "from" | "to" | "toTime"; label: string }) {
  const error = form.formState.errors[name];
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={`halaqa-${name}`}>{label}</FieldLabel>
      <Input id={`halaqa-${name}`} type="time" dir="ltr" {...form.register(name)} aria-invalid={!!error} />
      <FieldError errors={[error]} />
    </Field>
  );
}

/** «وقت الحلقة»: by prayers (after X until prayer Y / until a clock time) or by the clock (from…to). */
export function ScheduleFields({ form }: { form: Form }) {
  const mode = useWatch({ control: form.control, name: "mode" });
  const toKind = useWatch({ control: form.control, name: "toKind" });
  const errors = form.formState.errors;

  return (
    <FieldSet>
      <FieldLegend variant="label">وقت الحلقة</FieldLegend>
      <Controller
        control={form.control}
        name="mode"
        render={({ field }) => (
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={0}
            value={field.value}
            // Radix sends "" when the active item is pressed again; one mode must stay selected.
            onValueChange={(value) => value && field.onChange(value)}
            aria-label="طريقة تحديد الوقت"
          >
            <ToggleGroupItem value="PRAYER">بالصلوات</ToggleGroupItem>
            <ToggleGroupItem value="CLOCK">بالساعة</ToggleGroupItem>
          </ToggleGroup>
        )}
      />

      {mode === "CLOCK" ? (
        <div className="grid grid-cols-2 gap-3">
          <TimeField form={form} name="from" label="من الساعة" />
          <TimeField form={form} name="to" label="إلى الساعة" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Field data-invalid={!!errors.fromPrayer}>
            <FieldLabel htmlFor="halaqa-from-prayer">من بعد صلاة</FieldLabel>
            <PrayerSelect form={form} name="fromPrayer" id="halaqa-from-prayer" />
            <FieldError errors={[errors.fromPrayer]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="halaqa-to-kind">إلى</FieldLabel>
            <Controller
              control={form.control}
              name="toKind"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="halaqa-to-kind" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prayer">صلاة</SelectItem>
                    <SelectItem value="clock">الساعة</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <div className="col-span-2">
            {toKind === "clock" ? (
              <TimeField form={form} name="toTime" label="الساعة" />
            ) : (
              <Field data-invalid={!!errors.toPrayer}>
                <FieldLabel htmlFor="halaqa-to-prayer">صلاة</FieldLabel>
                <PrayerSelect form={form} name="toPrayer" id="halaqa-to-prayer" />
                <FieldError errors={[errors.toPrayer]} />
              </Field>
            )}
          </div>
        </div>
      )}
    </FieldSet>
  );
}
