"use client";

import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";

import { setTeacherWorkingAction } from "../actions";
import { type TeacherStatus, WORK_STATUS_LABELS } from "../profile";

const BADGE_VARIANT = { ACTIVE: "secondary", ON_LEAVE: "outline", SUSPENDED: "destructive" } as const;

export function TeacherStatusBadge({ status }: { status: TeacherStatus }) {
  return <Badge variant={BADGE_VARIANT[status]}>{WORK_STATUS_LABELS[status]}</Badge>;
}

/**
 * «عامل / متوقف»: teachers are suspended and brought back instead of being
 * deleted, so their halaqat and history stay intact.
 */
export function TeacherWorkingButton({
  teacher,
  restoreLabel = "إعادة عامل",
}: {
  teacher: { id: string; name: string; status: TeacherStatus };
  restoreLabel?: string;
}) {
  const toggle = useAction(setTeacherWorkingAction, {
    onSuccess: ({ name, status }) => toast.success(status === "SUSPENDED" ? `أُوقف «${name}»` : `عاد «${name}» عاملًا`),
  });

  if (teacher.status === "SUSPENDED") {
    return (
      <ConfirmDialog
        title={`إعادة «${teacher.name}» عاملًا؟`}
        description="يعود حسابه للعمل ويستطيع تسجيل الحضور والتسميع من جديد."
        confirmLabel={restoreLabel}
        onConfirm={() => toggle.execute({ id: teacher.id, working: true })}
      >
        <Button size="sm" disabled={toggle.pending}>
          {restoreLabel}
        </Button>
      </ConfirmDialog>
    );
  }
  return (
    <ConfirmDialog
      title={`إيقاف «${teacher.name}»؟`}
      description="لن يستطيع تسجيل حضور أو تسميع أو أي تعديل، ويرى رسالة الإيقاف عند دخوله. تبقى حلقاته وبياناته كما هي، ويمكن إعادته من «المعلمون ← المتوقفون»."
      confirmLabel="إيقاف"
      destructive
      onConfirm={() => toggle.execute({ id: teacher.id, working: false })}
    >
      <Button variant="outline" size="sm" disabled={toggle.pending}>
        إيقاف
      </Button>
    </ConfirmDialog>
  );
}
