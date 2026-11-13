"use client";

import { useState } from "react";

import { toast } from "sonner";

import { useAction } from "@/hooks/use-action";
import { ROLE_LABELS, type Role } from "@/lib/constants";

import { bulkResetPasswordsAction, deleteMembersAction } from "../actions";
import type { CredentialDTO, MemberRowDTO } from "../service";
import { PasswordConfirmDialog } from "./password-confirm-dialog";

const DELETE_NOTES: Partial<Record<Role, string>> = {
  STUDENT: "تُحذف معه سجلات الحضور والتسميع والاختبارات والاشتراكات.",
  TEACHER: "تبقى حلقاته بلا معلم.",
  SUPERVISOR: "تبقى حلقاته بلا مشرف.",
};

function NameList({ members }: { members: MemberRowDTO[] }) {
  if (members.length < 2) return null;
  return (
    <p className="max-h-36 overflow-auto rounded-lg border bg-muted/40 px-3 py-2 text-foreground">
      {members.map((m) => m.name).join("، ")}
    </p>
  );
}

/** Deletes one or several accounts. The administrator's own account is never part of it. */
export function DeleteMembersDialog({
  role,
  members,
  onClose,
  onDeleted,
}: {
  role: Role;
  members: MemberRowDTO[];
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const targets = members.filter((m) => !m.isSelf);
  const skippedSelf = targets.length < members.length;

  const remove = useAction(deleteMembersAction, {
    onSuccess: ({ deleted }) => {
      toast.success(deleted === 1 ? "تم حذف الحساب" : `تم حذف ${deleted} حساب`);
      onDeleted();
      onClose();
    },
    onError: setError,
  });

  return (
    <PasswordConfirmDialog
      title={targets.length === 1 ? `حذف «${targets[0].name}»؟` : `حذف ${targets.length} ${ROLE_LABELS[role]}؟`}
      confirmLabel="حذف"
      destructive
      pending={remove.pending}
      error={error}
      onClose={onClose}
      onConfirm={(confirmPassword) => {
        setError(null);
        remove.execute({ ids: targets.map((m) => m.id), confirmPassword });
      }}
    >
      <NameList members={targets} />
      {skippedSelf && <p>حسابك الحالي لن يُحذف.</p>}
      <p>{DELETE_NOTES[role]} ويُحذف حساب الدخول. لا يمكن التراجع عن الحذف.</p>
    </PasswordConfirmDialog>
  );
}

/** New passwords for the chosen members, shown once afterwards. */
export function BulkResetDialog({
  members,
  onClose,
  onDone,
}: {
  members: MemberRowDTO[];
  onClose: () => void;
  onDone: (credentials: CredentialDTO[]) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const targets = members.filter((m) => !m.isSelf);
  const skippedSelf = targets.length < members.length;
  const withoutNumber = targets.filter((m) => !m.whatsapp).length;

  const reset = useAction(bulkResetPasswordsAction, {
    onSuccess: ({ credentials }) => {
      onClose();
      onDone(credentials);
    },
    onError: setError,
  });

  return (
    <PasswordConfirmDialog
      title={`إرسال بيانات الدخول (${targets.length})`}
      confirmLabel="إنشاء كلمات جديدة وإظهارها"
      pending={reset.pending}
      error={error}
      onClose={onClose}
      onConfirm={(confirmPassword) => {
        setError(null);
        reset.execute({ ids: targets.map((m) => m.id), confirmPassword });
      }}
    >
      <p>
        كلمات المرور الحالية محفوظة على الخادم <b>مشفّرة</b> ولا يمكن لأحد عرضها، حتى المدير. لذلك تُنشأ{" "}
        <b>كلمة مرور جديدة</b> لكل من حددته فتتوقف القديمة فورًا، وتظهر لك <b>مرة واحدة</b> مع رسالة جاهزة ترسلها لكل
        شخص على انفراد.
      </p>
      <NameList members={targets} />
      {withoutNumber > 0 && <p>{withoutNumber} منهم بلا رقم واتساب؛ ستختار جهة الإرسال يدويًا.</p>}
      {skippedSelf && <p>حسابك الحالي غير مشمول.</p>}
      {reset.pending && targets.length > 20 && <p>جارٍ إنشاء الكلمات… قد يستغرق ذلك بعض الوقت.</p>}
    </PasswordConfirmDialog>
  );
}
