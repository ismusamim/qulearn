"use client";

import { type ReactNode, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";

import { setPayrollPinAction, updatePayrollSettingsAction } from "../actions";
import { RULE_FIELDS } from "../constants";
import { type SettingsInput, setPinSchema, settingsSchema } from "../schemas";
import type { PayrollSettingsDTO } from "../service";

export function RulesFormDialog({ settings, children }: { settings: PayrollSettingsDTO; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const form = useForm<SettingsInput, unknown, z.output<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: Object.fromEntries(RULE_FIELDS.map((f) => [f.key, settings[f.key]])) as SettingsInput,
  });
  const save = useAction(updatePayrollSettingsAction, { successMessage: "تم حفظ قواعد الحساب", onSuccess: () => setOpen(false) });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={form.handleSubmit((values) => save.execute(values))} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>قواعد الحساب</DialogTitle>
            <DialogDescription>تغيير القواعد يعيد حساب الشهور المفتوحة والمغلقة معًا.</DialogDescription>
          </DialogHeader>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            {RULE_FIELDS.map((f) => {
              const error = form.formState.errors[f.key];
              return (
                <Field key={f.key} data-invalid={!!error}>
                  <FieldLabel htmlFor={`rule-${f.key}`}>{f.label}</FieldLabel>
                  <Input
                    id={`rule-${f.key}`}
                    type="number"
                    step="any"
                    inputMode="decimal"
                    dir="ltr"
                    {...form.register(f.key)}
                    aria-invalid={!!error}
                  />
                  <FieldError errors={[error]} />
                </Field>
              );
            })}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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

/** Sets or changes the payroll PIN. Removing it is a separate, explicit button. */
export function PinFormDialog({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const save = useAction(setPayrollPinAction, {
    successMessage: "تم حفظ رمز قسم المرتبات",
    onSuccess: () => {
      setOpen(false);
      setPin("");
    },
  });

  const submit = () => {
    const parsed = setPinSchema.safeParse({ pin });
    if (!parsed.success || !parsed.data.pin) {
      setError(parsed.success ? "اكتب الرمز" : (parsed.error.issues[0]?.message ?? "الرمز غير صالح"));
      return;
    }
    setError("");
    save.execute(parsed.data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{enabled ? "تغيير رمز قسم المرتبات" : "تفعيل رمز قسم المرتبات"}</DialogTitle>
            <DialogDescription>يُطلب الرمز مرة عند فتح قسم المرتبات، فوق تسجيل دخول المدير.</DialogDescription>
          </DialogHeader>
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor="new-payroll-pin">الرمز الجديد</FieldLabel>
            <Input
              id="new-payroll-pin"
              type="password"
              dir="ltr"
              autoComplete="new-password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              aria-invalid={!!error}
            />
            {error && <FieldError>{error}</FieldError>}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
