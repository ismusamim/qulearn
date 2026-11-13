"use client";

import { type ReactNode, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { GRADES, RECITATION_TYPE_LABELS } from "@/lib/constants";
import { todayISO } from "@/lib/dates";
import { surahByNumber } from "@/lib/quran";

import { createRecitationAction } from "../actions";
import { type RecitationInput, recitationSchema } from "../schemas";
import { SurahCombobox } from "./surah-combobox";

function RecitationForm({ student, onDone }: { student: { id: string; name: string }; onDone: () => void }) {
  const form = useForm<RecitationInput>({
    resolver: zodResolver(recitationSchema),
    defaultValues: {
      studentId: student.id,
      date: todayISO(),
      type: "HIFZ",
      surah: 1,
      fromAyah: 1,
      toAyah: 1,
      grade: GRADES[0],
      note: "",
    },
  });
  const { errors } = form.formState;

  const create = useAction(createRecitationAction, {
    successMessage: "تم تسجيل التسميع",
    onSuccess: onDone,
    // Server-side range errors are shown next to the field they concern.
    onError: (error, fieldErrors) => {
      const field = (["surah", "fromAyah", "toAyah", "date", "grade", "note"] as const).find((f) => fieldErrors?.[f]);
      form.setError(field ?? "root", { message: field ? fieldErrors![field][0] : error });
    },
  });

  const surah = surahByNumber(useWatch({ control: form.control, name: "surah" }));

  return (
    <form onSubmit={form.handleSubmit((values) => create.execute(values))} className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>تسميع: {student.name}</DialogTitle>
      </DialogHeader>
      <FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <Field data-invalid={!!errors.date}>
            <FieldLabel htmlFor="rec-date">التاريخ</FieldLabel>
            <Input id="rec-date" type="date" dir="ltr" {...form.register("date")} aria-invalid={!!errors.date} />
            <FieldError errors={[errors.date]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="rec-type">النوع</FieldLabel>
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="rec-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(RECITATION_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>
        <Field data-invalid={!!errors.surah}>
          <FieldLabel htmlFor="rec-surah">السورة</FieldLabel>
          <Controller
            control={form.control}
            name="surah"
            render={({ field }) => (
              <SurahCombobox id="rec-surah" value={field.value} onChange={field.onChange} invalid={!!errors.surah} />
            )}
          />
          <FieldError errors={[errors.surah]} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field data-invalid={!!errors.fromAyah}>
            <FieldLabel htmlFor="rec-from">من آية</FieldLabel>
            <Input
              id="rec-from"
              type="number"
              dir="ltr"
              min={1}
              max={surah?.ayat}
              {...form.register("fromAyah", { valueAsNumber: true })}
              aria-invalid={!!errors.fromAyah}
            />
            <FieldError errors={[errors.fromAyah]} />
          </Field>
          <Field data-invalid={!!errors.toAyah}>
            <FieldLabel htmlFor="rec-to">إلى آية</FieldLabel>
            <Input
              id="rec-to"
              type="number"
              dir="ltr"
              min={1}
              max={surah?.ayat}
              {...form.register("toAyah", { valueAsNumber: true })}
              aria-invalid={!!errors.toAyah}
            />
            <FieldError errors={[errors.toAyah]} />
          </Field>
        </div>
        {surah && (
          <FieldDescription>
            سورة {surah.name} عدد آياتها {surah.ayat}
          </FieldDescription>
        )}
        <Field>
          <FieldLabel htmlFor="rec-grade">التقدير</FieldLabel>
          <Controller
            control={form.control}
            name="grade"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="rec-grade" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRADES.map((grade) => (
                    <SelectItem key={grade} value={grade}>
                      {grade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field data-invalid={!!errors.note}>
          <FieldLabel htmlFor="rec-note">ملاحظة</FieldLabel>
          <Textarea id="rec-note" rows={3} {...form.register("note")} aria-invalid={!!errors.note} />
          <FieldError errors={[errors.note]} />
        </Field>
        <FieldError errors={[errors.root]} />
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          إلغاء
        </Button>
        <Button type="submit" disabled={create.pending}>
          {create.pending && <Spinner />}
          حفظ
        </Button>
      </DialogFooter>
    </form>
  );
}

/**
 * «تسجيل تسميع» for one student. Controlled: pass the student to record for, or
 * null to close. The form is mounted per opening, so it always starts fresh.
 */
export function RecitationDialog({
  student,
  onClose,
}: {
  student: { id: string; name: string } | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!student} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {student && <RecitationForm key={student.id} student={student} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

/** Same dialog with its own trigger button (`children`). */
export function RecitationDialogTrigger({
  student,
  children,
}: {
  student: { id: string; name: string };
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {open && <RecitationForm student={student} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}
