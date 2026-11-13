"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";

import { deleteStudentAction } from "../actions";
import { deleteStudentSchema } from "../schemas";

/** Deleting a student is irreversible, so the admin confirms with their own password. */
export function DeleteStudentDialog({
  student,
  onClose,
  onDeleted,
}: {
  student: { id: string; name: string };
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const form = useForm<{ id: string; password: string }>({
    resolver: zodResolver(deleteStudentSchema),
    defaultValues: { id: student.id, password: "" },
  });
  const remove = useAction(deleteStudentAction, {
    successMessage: "تم حذف الطالب",
    onSuccess: () => {
      onClose();
      onDeleted?.();
    },
  });
  const error = form.formState.errors.password;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={form.handleSubmit((values) => remove.execute(values))} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>حذف «{student.name}»</DialogTitle>
            <DialogDescription>تُحذف معه سجلات الحضور والتسميع والاشتراكات وحساب الدخول. لا يمكن التراجع.</DialogDescription>
          </DialogHeader>
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor="delete-password">كلمة مرورك للتأكيد</FieldLabel>
            <Input
              id="delete-password"
              type="password"
              dir="ltr"
              autoComplete="current-password"
              autoFocus
              aria-invalid={!!error}
              {...form.register("password")}
            />
            <FieldError errors={[error]} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" variant="destructive" disabled={remove.pending}>
              {remove.pending && <Spinner />}
              حذف
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
