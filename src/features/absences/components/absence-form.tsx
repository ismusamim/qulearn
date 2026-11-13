"use client";

import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAction } from "@/hooks/use-action";
import { MONTHS_AR, weekdayName } from "@/lib/dates";

import { createAbsenceAction } from "../actions";
import { ABSENCE_REASONS, OTHER_PLACE, OTHER_REASON, PERMISSION_LABELS, PROOF_LABELS } from "../constants";
import { type AbsenceFormValues, absenceFormSchema, toCreateAbsenceInput } from "../schemas";
import type { AbsenceFormOptions } from "../service";
import { TeacherCombobox } from "./teacher-combobox";

const required = <b className="text-destructive">*</b>;

/**
 * The absence sheet supervisors used to fill as a Google form: who, which day,
 * where, with or without permission, and why. The payroll month and the proof
 * are the administration's fields.
 */
export function AbsenceForm({ options }: { options: AbsenceFormOptions }) {
  const { staff, places, payMonth, today, isAdmin } = options;
  const blank: AbsenceFormValues = {
    employeeId: "",
    date: today,
    place: "",
    placeOther: "",
    permission: "",
    reason: "",
    reasonOther: "",
    note: "",
    payMonth: 0,
    proof: "",
  };
  const form = useForm<AbsenceFormValues>({ resolver: zodResolver(absenceFormSchema), defaultValues: blank });
  const errors = form.formState.errors;
  const [date, place, reason] = useWatch({ control: form.control, name: ["date", "place", "reason"] });

  const router = useRouter();
  const create = useAction(createAbsenceAction, {
    onSuccess: ({ name, year, month }) => {
      toast.success(`تم تسجيل غياب ${name}`);
      // Show the log of the payroll month the absence was charged to.
      router.replace(`/absences?y=${year}&m=${month}`);
      // Several teachers are usually recorded for the same day and place: keep those.
      const v = form.getValues();
      form.reset({ ...blank, date: v.date, place: v.place, placeOther: v.placeOther, payMonth: v.payMonth });
    },
  });

  if (staff.length === 0) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            title={isAdmin ? "لا يوجد معلمون في سجل الموظفين" : "لا يوجد معلمون مسجلون بعد"}
            description={isAdmin ? "أضفهم من «المرتبات ← الموظفون»." : "تواصل مع الإدارة."}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>تسجيل غياب معلم</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit((v) => create.execute(toCreateAbsenceInput(v)))} className="flex flex-col gap-6">
          <FieldSet>
            <FieldLegend>بيانات الغياب</FieldLegend>
            <FieldGroup>
              <Field data-invalid={!!errors.employeeId}>
                <FieldLabel htmlFor="abs-teacher">اسم المعلم {required}</FieldLabel>
                <Controller
                  control={form.control}
                  name="employeeId"
                  render={({ field }) => (
                    <TeacherCombobox
                      id="abs-teacher"
                      staff={staff}
                      value={field.value}
                      invalid={!!errors.employeeId}
                      onChange={(employee) => {
                        field.onChange(employee.id);
                        // Preselect the teacher's usual place when it is one of the known places.
                        if (employee.place && places.includes(employee.place)) {
                          form.setValue("place", employee.place, { shouldValidate: true });
                        }
                      }}
                    />
                  )}
                />
                <FieldError errors={[errors.employeeId]} />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={!!errors.date}>
                  <FieldLabel htmlFor="abs-date">اليوم {required}</FieldLabel>
                  <Input id="abs-date" type="date" dir="ltr" {...form.register("date")} aria-invalid={!!errors.date} />
                  <FieldDescription>{weekdayName(date) || " "}</FieldDescription>
                  <FieldError errors={[errors.date]} />
                </Field>
                {isAdmin && (
                  <Field>
                    <FieldLabel htmlFor="abs-month">شهر المرتب</FieldLabel>
                    <NativeSelect id="abs-month" className="w-full" {...form.register("payMonth", { valueAsNumber: true })}>
                      <NativeSelectOption value={0}>
                        الافتراضي — {MONTHS_AR[payMonth.month - 1]} ({payMonth.month}) {payMonth.year}
                      </NativeSelectOption>
                      {MONTHS_AR.map((name, i) => (
                        <NativeSelectOption key={name} value={i + 1}>
                          {name} ({i + 1})
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    <FieldDescription>الشهر الذي يُحسب عليه الغياب في المرتبات.</FieldDescription>
                  </Field>
                )}
              </div>

              <Field data-invalid={!!errors.place}>
                <FieldLabel htmlFor="abs-place">مكان الحلقة {required}</FieldLabel>
                <NativeSelect id="abs-place" className="w-full" {...form.register("place")} aria-invalid={!!errors.place}>
                  <NativeSelectOption value="">— اختر —</NativeSelectOption>
                  {places.map((p) => (
                    <NativeSelectOption key={p} value={p}>
                      {p}
                    </NativeSelectOption>
                  ))}
                  <NativeSelectOption value={OTHER_PLACE}>مكان آخر…</NativeSelectOption>
                </NativeSelect>
                <FieldError errors={[errors.place]} />
              </Field>
              {place === OTHER_PLACE && (
                <Field data-invalid={!!errors.placeOther}>
                  <FieldLabel htmlFor="abs-place-other">اكتب المكان</FieldLabel>
                  <Input id="abs-place-other" {...form.register("placeOther")} aria-invalid={!!errors.placeOther} />
                  <FieldError errors={[errors.placeOther]} />
                </Field>
              )}
            </FieldGroup>
          </FieldSet>

          <FieldSet>
            <FieldLegend>الإذن والسبب</FieldLegend>
            <FieldGroup>
              <Field>
                <FieldLabel id="abs-permission">الإذن</FieldLabel>
                <Controller
                  control={form.control}
                  name="permission"
                  render={({ field }) => (
                    // Pressing the chosen chip again clears the choice.
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      aria-labelledby="abs-permission"
                      className="flex-wrap"
                      value={field.value}
                      onValueChange={(v) => field.onChange(v)}
                    >
                      {Object.entries(PERMISSION_LABELS).map(([value, label]) => (
                        <ToggleGroupItem key={value} value={value}>
                          {label}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  )}
                />
              </Field>
              <Field data-invalid={!!errors.reason}>
                <FieldLabel id="abs-reason">السبب {required}</FieldLabel>
                <Controller
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      aria-labelledby="abs-reason"
                      className="w-full flex-wrap"
                      value={field.value}
                      onValueChange={(v) => field.onChange(v)}
                    >
                      {[...ABSENCE_REASONS, OTHER_REASON].map((r) => (
                        <ToggleGroupItem key={r} value={r}>
                          {r}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  )}
                />
                <FieldError errors={[errors.reason]} />
              </Field>
              {reason === OTHER_REASON && (
                <Field data-invalid={!!errors.reasonOther}>
                  <FieldLabel htmlFor="abs-reason-other">اكتب السبب</FieldLabel>
                  <Input id="abs-reason-other" {...form.register("reasonOther")} aria-invalid={!!errors.reasonOther} />
                  <FieldError errors={[errors.reasonOther]} />
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor="abs-note">
                  ملاحظات <span className="font-normal text-muted-foreground">(اختياري)</span>
                </FieldLabel>
                <Textarea id="abs-note" rows={2} {...form.register("note")} />
              </Field>
              {isAdmin && (
                <Field>
                  <FieldLabel htmlFor="abs-proof">
                    الإثبات <span className="font-normal text-muted-foreground">(للإدارة)</span>
                  </FieldLabel>
                  <NativeSelect id="abs-proof" className="w-full" {...form.register("proof")}>
                    <NativeSelectOption value="">— لاحقًا —</NativeSelectOption>
                    <NativeSelectOption value="BALANCE">{PROOF_LABELS.BALANCE} (يُخصم من الإجازات)</NativeSelectOption>
                    <NativeSelectOption value="PROVEN">{PROOF_LABELS.PROVEN}</NativeSelectOption>
                  </NativeSelect>
                </Field>
              )}
            </FieldGroup>
          </FieldSet>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={create.pending}>
              {create.pending && <Spinner />}
              تسجيل الغياب
            </Button>
            <Button type="button" variant="outline" onClick={() => form.reset(blank)}>
              مسح النموذج
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
