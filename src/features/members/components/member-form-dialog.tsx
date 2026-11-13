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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import { ROLE_LABELS, type Role } from "@/lib/constants";

import { createMemberAction, updateMemberAction } from "../actions";
import { type MemberFormInput, memberFormSchema } from "../schemas";
import type { CredentialDTO, MemberRowDTO } from "../service";

/** Create (no `member`) or edit the name and phone of an account. Mounted only while open. */
export function MemberFormDialog({
  role,
  member,
  onClose,
  onCreated,
}: {
  role: Role;
  member?: MemberRowDTO;
  onClose: () => void;
  /** Receives the generated password, to be shown once. */
  onCreated: (credential: CredentialDTO) => void;
}) {
  const form = useForm<MemberFormInput>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: { name: member?.name ?? "", phone: member?.phone ?? "" },
  });
  const { errors } = form.formState;

  const create = useAction(createMemberAction, {
    successMessage: "تم إنشاء الحساب",
    onSuccess: (credential) => {
      onClose();
      onCreated(credential);
    },
  });
  const update = useAction(updateMemberAction, { successMessage: "تم حفظ التعديلات", onSuccess: onClose });
  const pending = create.pending || update.pending;

  const submit = form.handleSubmit((values) =>
    member ? update.execute({ ...values, id: member.id }) : create.execute({ ...values, role }),
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{member ? `تعديل: ${member.name}` : `إضافة ${ROLE_LABELS[role]}`}</DialogTitle>
            {!member && (
              <DialogDescription>
                ستُنشأ كلمة المرور تلقائيًا (6 أرقام) وتظهر لك مرة واحدة بعد الحفظ.
                {role === "STUDENT" && " يُنشأ هنا الحساب الأساسي فقط؛ أكمل استمارة الطالب من قسم «الطلاب»."}
                {role === "TEACHER" && " يُنشأ هنا الحساب الأساسي فقط؛ أكمل ملف المعلم من قسم «المعلمون»."}
              </DialogDescription>
            )}
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="member-name">الاسم</FieldLabel>
              <Input id="member-name" autoFocus {...form.register("name")} aria-invalid={!!errors.name} />
              <FieldError errors={[errors.name]} />
            </Field>
            <Field data-invalid={!!errors.phone}>
              <FieldLabel htmlFor="member-phone">الجوال</FieldLabel>
              <Input
                id="member-phone"
                type="tel"
                dir="ltr"
                inputMode="tel"
                className="text-end"
                {...form.register("phone")}
                aria-invalid={!!errors.phone}
              />
              <FieldError errors={[errors.phone]} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
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
