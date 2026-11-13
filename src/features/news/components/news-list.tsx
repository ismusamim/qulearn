"use client";

import { MegaphoneIcon, Trash2Icon } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { NEWS_AUDIENCE_LABELS } from "@/lib/constants";

import { deleteNewsAction } from "../actions";
import { NOTE_AUDIENCE_LABELS, type NoteAudience } from "../schemas";
import type { NewsDTO } from "../service";

function audienceLabel(item: NewsDTO, sent: boolean): string {
  if (sent && item.audience in NOTE_AUDIENCE_LABELS) return `إلى ${NOTE_AUDIENCE_LABELS[item.audience as NoteAudience]}`;
  return NEWS_AUDIENCE_LABELS[item.audience];
}

/**
 * Announcements, newest first. Notes sent to the administration carry their
 * sender's signature. `showAudience` is for admins and for a sender's own notes.
 */
export function NewsList({
  items,
  showAudience = false,
  sent = false,
  emptyTitle = "لا توجد إعلانات.",
}: {
  items: NewsDTO[];
  showAudience?: boolean;
  /** The list is the user's own sent notes: no signature, «إلى …» instead. */
  sent?: boolean;
  emptyTitle?: string;
}) {
  const remove = useAction(deleteNewsAction, { successMessage: "تم الحذف" });

  if (items.length === 0) return <EmptyState icon={MegaphoneIcon} title={emptyTitle} />;

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-3 rounded-lg border border-s-4 border-s-gold bg-card p-3">
          <div className="min-w-0 flex-1">
            {item.authorLabel && !sent && (
              <p className="mb-1 text-xs font-semibold text-muted-foreground">ملاحظة من {item.authorLabel}</p>
            )}
            <p className="whitespace-pre-wrap break-words leading-relaxed">{item.text}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span dir="ltr">{item.date}</span>
              {(showAudience || sent) && <Badge variant="secondary">{audienceLabel(item, sent)}</Badge>}
            </div>
          </div>
          {item.canDelete && (
            <ConfirmDialog
              title={item.authorLabel ? "حذف الملاحظة؟" : "حذف الإعلان؟"}
              description="لا يمكن التراجع عن الحذف."
              confirmLabel="حذف"
              destructive
              onConfirm={() => remove.execute({ id: item.id })}
            >
              <Button variant="ghost" size="icon-sm" aria-label="حذف" disabled={remove.pending} className="no-print">
                <Trash2Icon className="text-destructive" />
              </Button>
            </ConfirmDialog>
          )}
        </li>
      ))}
    </ul>
  );
}
