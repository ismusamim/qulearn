"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";

import { setPasswordAction } from "../actions";
import { type PasswordFormInput, passwordFormSchema } from "../schemas";
import type { MemberRowDTO } from "../service";

/** Lets the administrator choose the password instead of generating one. Mounted only while open. */
export function SetPasswordDialog({ member, onClose }: { member: MemberRowDTO; onClose: () => void }) {
  const form = useForm<PasswordFormInput>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { password: "" },
  });
  const error = form.formState.errors.password;
  const save = useAction(setPasswordAction, { successMessage: "تم تغيير كلمة المرور", onSuccess: onClose });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={form.handleSubmit((values) => save.execute({ ...values, id: member.id }))}
          className="flex flex-col gap-5"
        >
          <DialogHeader>
            <DialogTitle>كلمة مرور محددة لـ «{member.name}»</DialogTitle>
            <DialogDescription>
              {member.canLogin ? "ستتوقف الكلمة القديمة عن العمل فورًا. " : ""}
              الكلمة تُحفظ مشفّرة ولا يمكن عرضها لاحقًا، فاحتفظ بها لتسليمها لصاحبها.
            </DialogDescription>
          </DialogHeader>
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor="member-password">كلمة المرور الجديدة</FieldLabel>
            {/* Plain text on purpose: the admin types it to hand it over, not to keep it secret from themselves. */}
            <Input
              id="member-password"
              dir="ltr"
              autoFocus
              autoComplete="off"
              className="text-end"
              {...form.register("password")}
              aria-invalid={!!error}
            />
            <FieldError errors={[error]} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
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
