"use client";

import type { ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * Asks before a destructive or irreversible step.
 *
 *   <ConfirmDialog title="حذف المكان؟" description="…" confirmLabel="حذف" destructive onConfirm={() => execute({ id })}>
 *     <Button variant="destructive" size="sm">حذف</Button>
 *   </ConfirmDialog>
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel = "تأكيد",
  cancelLabel = "إلغاء",
  destructive = false,
  onConfirm,
  children,
}: {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  /** The trigger element (a button). */
  children: ReactNode;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction variant={destructive ? "destructive" : "default"} onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
