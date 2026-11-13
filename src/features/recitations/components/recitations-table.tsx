"use client";

import { BookOpenIcon, Trash2Icon } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAction } from "@/hooks/use-action";
import { RECITATION_TYPE_LABELS } from "@/lib/constants";

import { deleteRecitationAction } from "../actions";
import { positionText } from "../progress";
import type { RecitationDTO } from "../service";

/** «سجل التسميع». The delete column appears only when the viewer may delete at least one row. */
export function RecitationsTable({ recitations }: { recitations: RecitationDTO[] }) {
  const remove = useAction(deleteRecitationAction, { successMessage: "تم حذف التسجيل" });
  const anyDeletable = recitations.some((r) => r.canDelete);

  if (recitations.length === 0) return <EmptyState icon={BookOpenIcon} title="لا توجد تسجيلات بعد." />;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>التاريخ</TableHead>
          <TableHead>النوع</TableHead>
          <TableHead>الموضع</TableHead>
          <TableHead>التقدير</TableHead>
          <TableHead>ملاحظة</TableHead>
          <TableHead>سجّله</TableHead>
          {anyDeletable && <TableHead className="no-print w-0" />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {recitations.map((r) => (
          <TableRow key={r.id}>
            <TableCell>
              <span dir="ltr">{r.date}</span>
            </TableCell>
            <TableCell>
              <Badge variant={r.type === "HIFZ" ? "default" : "secondary"}>{RECITATION_TYPE_LABELS[r.type]}</Badge>
            </TableCell>
            <TableCell className="font-medium">{positionText(r)}</TableCell>
            <TableCell>{r.grade || "—"}</TableCell>
            <TableCell className="max-w-64 whitespace-normal text-muted-foreground">{r.note || "—"}</TableCell>
            <TableCell className="text-muted-foreground">{r.recordedByName ?? "—"}</TableCell>
            {anyDeletable && (
              <TableCell className="no-print">
                {r.canDelete && (
                  <ConfirmDialog
                    title="حذف هذا التسجيل؟"
                    description={`${RECITATION_TYPE_LABELS[r.type]} — ${positionText(r)} بتاريخ ${r.date}. لا يمكن التراجع عن الحذف.`}
                    confirmLabel="حذف"
                    destructive
                    onConfirm={() => remove.execute({ id: r.id })}
                  >
                    <Button variant="ghost" size="icon-sm" aria-label="حذف التسجيل" disabled={remove.pending}>
                      <Trash2Icon className="text-destructive" />
                    </Button>
                  </ConfirmDialog>
                )}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
