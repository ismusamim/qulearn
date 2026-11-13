"use client";

import { type ReactNode, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { EMPLOYEE_STATUS_LABELS, ROLE_LABELS } from "@/lib/constants";

import { createEmployeeAction, updateEmployeeAction } from "../actions";
import { JOB_TITLES, WORK_SYSTEMS } from "../constants";
import type { EmployeeDTO, LinkableMemberDTO } from "../employees-service";
import { type EmployeeInput, employeeSchema } from "../schemas";
import { statusMessage } from "./status-message";

const AMOUNTS = [
  { name: "basic", label: "الأساسي" },
  { name: "rate", label: "سعر ساعة الإضافي" },
  { name: "incentive", label: "الحافز" },
  { name: "transport", label: "بدل الانتقال" },
  { name: "hours", label: "الساعات الأساسية" },
] as const;

const isJobTitle = (v: string): v is (typeof JOB_TITLES)[number] => (JOB_TITLES as readonly string[]).includes(v);
const isWorkSystem = (v: string): v is (typeof WORK_SYSTEMS)[number] => (WORK_SYSTEMS as readonly string[]).includes(v);

/** Create (no `employee`) or edit a payroll employee. `children` is the button that opens the dialog. */
export function EmployeeFormDialog({
  employee,
  members,
  nextCode,
  defaultHours,
  children,
}: {
  employee?: EmployeeDTO;
  members: LinkableMemberDTO[];
  nextCode: string;
  defaultHours: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<EmployeeInput, unknown, z.output<typeof employeeSchema>>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      code: employee?.code ?? nextCode,
      name: employee?.name ?? "",
      jobTitle: employee && isJobTitle(employee.jobTitle) ? employee.jobTitle : "معلم",
      workSystem: employee && isWorkSystem(employee.workSystem) ? employee.workSystem : "",
      status: employee?.status ?? "ACTIVE",
      basic: employee?.basic ?? "",
      rate: employee?.rate ?? "",
      incentive: employee?.incentive ?? "",
      transport: employee?.transport ?? "",
      hours: employee ? (employee.hours ?? "") : defaultHours,
      place: employee?.place ?? "",
      note: employee?.note ?? "",
      memberId: employee?.memberId ?? "",
    },
  });
  const errors = form.formState.errors;

  const done = () => {
    setOpen(false);
    if (!employee) form.reset();
  };
  const create = useAction(createEmployeeAction, { successMessage: "تمت إضافة الموظف", onSuccess: done });
  const update = useAction(updateEmployeeAction, {
    onSuccess: (change) => {
      toast.success(change ? statusMessage(change) : "تم حفظ التعديلات");
      done();
    },
  });
  const pending = create.pending || update.pending;

  const submit = form.handleSubmit((values) =>
    employee ? update.execute({ ...values, id: employee.id }) : create.execute(values),
  );

  // An account can belong to one employee only.
  const freeMembers = members.filter((m) => !m.employeeId || m.employeeId === employee?.id);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{employee ? `تعديل: ${employee.name}` : "موظف جديد"}</DialogTitle>
          </DialogHeader>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="emp-code">الكود</FieldLabel>
              <Input id="emp-code" {...form.register("code")} />
            </Field>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="emp-name">الاسم</FieldLabel>
              <Input id="emp-name" {...form.register("name")} aria-invalid={!!errors.name} />
              <FieldError errors={[errors.name]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="emp-job">الوظيفة</FieldLabel>
              <NativeSelect id="emp-job" className="w-full" {...form.register("jobTitle")}>
                {JOB_TITLES.map((t) => (
                  <NativeSelectOption key={t} value={t}>
                    {t}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="emp-system">نظام العمل</FieldLabel>
              <NativeSelect id="emp-system" className="w-full" {...form.register("workSystem")}>
                <NativeSelectOption value="">—</NativeSelectOption>
                {WORK_SYSTEMS.map((s) => (
                  <NativeSelectOption key={s} value={s}>
                    {s}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="emp-status">الحالة</FieldLabel>
              <NativeSelect id="emp-status" className="w-full" {...form.register("status")}>
                <NativeSelectOption value="ACTIVE">عامل</NativeSelectOption>
                <NativeSelectOption value="STOPPED">{EMPLOYEE_STATUS_LABELS.STOPPED}</NativeSelectOption>
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="emp-place">مكان العمل</FieldLabel>
              <Input id="emp-place" {...form.register("place")} />
            </Field>
            {AMOUNTS.map((f) => (
              <Field key={f.name} data-invalid={!!errors[f.name]}>
                <FieldLabel htmlFor={`emp-${f.name}`}>{f.label}</FieldLabel>
                <Input
                  id={`emp-${f.name}`}
                  type="number"
                  step="any"
                  inputMode="decimal"
                  dir="ltr"
                  {...form.register(f.name)}
                  aria-invalid={!!errors[f.name]}
                />
                <FieldError errors={[errors[f.name]]} />
              </Field>
            ))}
            <Field>
              <FieldLabel htmlFor="emp-member">حساب الدخول المرتبط</FieldLabel>
              <NativeSelect id="emp-member" className="w-full" {...form.register("memberId")}>
                <NativeSelectOption value="">— بلا حساب —</NativeSelectOption>
                {freeMembers.map((m) => (
                  <NativeSelectOption key={m.id} value={m.id}>
                    {m.name} — {ROLE_LABELS[m.role]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldDescription>يربط الموظف بحسابه (معلم، مشرف…) إن كان له حساب.</FieldDescription>
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="emp-note">ملاحظات</FieldLabel>
              <Textarea id="emp-note" rows={2} {...form.register("note")} />
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
