import { InboxIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { type FieldTarget, type ImportKind, TARGET_HALAQA, TARGET_PIN } from "../fields";
import type { PendingColumnDTO } from "../pending-service";
import { PendingCard } from "./pending-card";

export function PendingColumns({ columns, targets }: { columns: PendingColumnDTO[]; targets: Record<ImportKind, FieldTarget[]> }) {
  // A pending column can be linked to any field except the halaqa and the password.
  const linkable = (kind: ImportKind) => targets[kind].filter((t) => t.id !== TARGET_HALAQA && t.id !== TARGET_PIN);

  return (
    <div className="flex flex-col gap-6">
      <Alert>
        <AlertDescription>
          عند استيراد ملف، الأعمدة التي لها نظير في النظام تُستورد مباشرة في مكانها، والأعمدة التي ليس لها نظير تُحفظ هنا. راجع كل
          عمود: عدّل اسمه ونوعه وقيمه، ثم اعتمد إنشاء حقل جديد له، أو اربطه بحقل موجود.
        </AlertDescription>
      </Alert>
      {columns.length === 0 ? (
        <EmptyState icon={InboxIcon} title="لا توجد بيانات معلّقة." />
      ) : (
        // The key includes the header so a saved rename resets the card's local state.
        columns.map((column) => <PendingCard key={`${column.id}:${column.header}`} column={column} targets={linkable(column.kind)} />)
      )}
    </div>
  );
}
