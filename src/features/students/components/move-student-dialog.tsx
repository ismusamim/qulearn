"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";

import { moveStudentAction } from "../actions";
import type { HalaqaChoice, StudentRowDTO } from "../queries";
import { moveStudentSchema } from "../schemas";

const fullLabel = (h: HalaqaChoice) => `${h.placeName ? `${h.placeName} — ` : ""}${h.label}`;

/** نقل الطالب to another halaqa; the list reads «المكان — الحلقة» so a move between places is one choice. */
export function MoveStudentDialog({
  student,
  halaqat,
  onClose,
}: {
  student: StudentRowDTO;
  halaqat: HalaqaChoice[];
  onClose: () => void;
}) {
  const options = halaqat.map((h) => ({ id: h.id, label: fullLabel(h) })).sort((a, b) => a.label.localeCompare(b.label, "ar"));
  const form = useForm<{ id: string; halaqaId: string }>({
    resolver: zodResolver(moveStudentSchema),
    defaultValues: { id: student.id, halaqaId: student.halaqaId ?? "" },
  });
  const move = useAction(moveStudentAction, {
    onSuccess: () => {
      const target = options.find((o) => o.id === form.getValues("halaqaId"));
      toast.success(`نُقل «${student.name}» إلى ${target?.label ?? "الحلقة"}`);
      onClose();
    },
  });
  const submit = form.handleSubmit((values) => {
    if (values.halaqaId === student.halaqaId) {
      form.setError("halaqaId", { message: "اختر حلقة مختلفة" });
      return;
    }
    move.execute(values);
  });
  const error = form.formState.errors.halaqaId;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>نقل الطالب: {student.name}</DialogTitle>
            <DialogDescription>
              الحالية: {student.halaqaLabel ? `${student.placeName ?? "—"} — ${student.halaqaLabel}` : "بلا حلقة"}
            </DialogDescription>
          </DialogHeader>
          {options.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد حلقات.</p>
          ) : (
            <Field data-invalid={!!error}>
              <FieldLabel htmlFor="move-halaqa">إلى (المكان — الحلقة)</FieldLabel>
              <NativeSelect id="move-halaqa" className="w-full" aria-invalid={!!error} {...form.register("halaqaId")}>
                <NativeSelectOption value="">— اختر —</NativeSelectOption>
                {options.map((o) => (
                  <NativeSelectOption key={o.id} value={o.id}>
                    {o.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldError errors={[error]} />
            </Field>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" disabled={move.pending || options.length === 0}>
              {move.pending && <Spinner />}
              نقل
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
