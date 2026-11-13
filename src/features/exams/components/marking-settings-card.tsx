"use client";

import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";

import { updateMarkingSettingsAction } from "../actions";
import { type MarkingSettingsInput, markingSettingsSchema } from "../schemas";
import type { MarkingSettings } from "../scoring";

const FIELDS: ReadonlyArray<{ name: keyof MarkingSettingsInput; label: string; step: string }> = [
  { name: "questionScore", label: "درجة السؤال", step: "0.01" },
  { name: "mistakePenalty", label: "خصم الخطأ", step: "0.01" },
  { name: "promptPenalty", label: "خصم التنبيه", step: "0.01" },
  { name: "tajweedPenalty", label: "خصم خطأ التجويد", step: "0.01" },
  { name: "excellentFrom", label: "ممتاز من (%)", step: "1" },
  { name: "veryGoodFrom", label: "جيد جدًا من (%)", step: "1" },
  { name: "goodFrom", label: "جيد من (%)", step: "1" },
  { name: "passFrom", label: "مقبول من (%)", step: "1" },
];

/** Admin only: the question score, each deduction and the grade boundaries. */
export function MarkingSettingsCard({ settings }: { settings: MarkingSettings }) {
  const [open, setOpen] = useState(false);
  const form = useForm<MarkingSettingsInput>({ resolver: zodResolver(markingSettingsSchema), defaultValues: settings });
  const save = useAction(updateMarkingSettingsAction, { successMessage: "تم حفظ إعدادات التصحيح", onSuccess: () => setOpen(false) });
  const { errors } = form.formState;

  const onOpenChange = (next: boolean) => {
    if (next) form.reset(settings);
    setOpen(next);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>إعدادات التصحيح</CardTitle>
        <CardAction>
          <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                تعديل
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <form onSubmit={form.handleSubmit((values) => save.execute(values))} className="flex flex-col gap-5">
                <DialogHeader>
                  <DialogTitle>إعدادات التصحيح</DialogTitle>
                  <DialogDescription>
                    درجة كل سؤال، وما يُخصم منها لكل خطأ وتنبيه وخطأ تجويد، وحدود التقديرات بالنسبة المئوية. التغيير يسري على الاختبارات
                    الجديدة.
                  </DialogDescription>
                </DialogHeader>
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                  {FIELDS.map(({ name, label, step }) => (
                    <Field key={name} data-invalid={!!errors[name]}>
                      <FieldLabel htmlFor={`marking-${name}`}>{label}</FieldLabel>
                      <Input
                        id={`marking-${name}`}
                        type="number"
                        dir="ltr"
                        min={0}
                        step={step}
                        aria-invalid={!!errors[name]}
                        {...form.register(name, { valueAsNumber: true })}
                      />
                      <FieldError errors={[errors[name]]} />
                    </Field>
                  ))}
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
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          درجة السؤال <b dir="ltr">{settings.questionScore}</b> — يُخصم لكل خطأ <b dir="ltr">{settings.mistakePenalty}</b>، ولكل تنبيه{" "}
          <b dir="ltr">{settings.promptPenalty}</b>، ولكل خطأ تجويد <b dir="ltr">{settings.tajweedPenalty}</b>. التقديرات: ممتاز من{" "}
          <span dir="ltr">{settings.excellentFrom}%</span>، جيد جدًا من <span dir="ltr">{settings.veryGoodFrom}%</span>، جيد من{" "}
          <span dir="ltr">{settings.goodFrom}%</span>، مقبول من <span dir="ltr">{settings.passFrom}%</span>، وما دونه ضعيف.
        </p>
      </CardContent>
    </Card>
  );
}
