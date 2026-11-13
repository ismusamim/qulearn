"use client";

import { useState } from "react";

import { SaveIcon, SendIcon, UsersIcon } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAction } from "@/hooks/use-action";
import { CURRENCY_LABEL } from "@/lib/constants";
import { formatMoney } from "@/lib/format";

import { saveCollectionAction } from "../actions";
import type { TeacherCollectionDTO } from "../service";
import { LineStateBadge } from "./collection-badges";

type Draft = Record<string, { amount: string; note: string }>;

function Banner({ data }: { data: TeacherCollectionDTO }) {
  const c = data.collection;
  if (!c) {
    return (
      <p className="text-sm text-muted-foreground">
        اكتب ما حصّلته من كل طالب هذا الشهر (والملاحظة إن وُجدت)، ثم «إرسال للمحاسب». الطالب الذي لم يدفع اترك خانته فارغة.
      </p>
    );
  }
  const returned = data.rows.filter((r) => r.state === "ISSUE").length;
  return (
    <Alert variant={c.status === "RETURNED" ? "destructive" : "default"}>
      <AlertDescription>
        {c.status === "SENT" && "أُرسلت للمحاسب — بانتظار المراجعة."}
        {c.status === "DONE" && `أكّد المحاسب القائمة كاملة${c.reviewedByName ? ` (${c.reviewedByName})` : ""}.`}
        {c.status === "DRAFT" && "مسودة محفوظة لم تُرسل بعد."}
        {c.status === "RETURNED" && (
          <>
            أعاد المحاسب {returned} اسمًا (بالأحمر): صحّحها ثم «إرسال للمحاسب».
            {c.accountantNote && <div>ملاحظة المحاسب: {c.accountantNote}</div>}
          </>
        )}
      </AlertDescription>
    </Alert>
  );
}

/** The teacher's list for one halaqa and month: what was collected from each student, and a note. */
export function TeacherCollectionForm({
  data,
  year,
  month,
  monthName,
}: {
  data: TeacherCollectionDTO & { halaqaId: string };
  year: number;
  month: number;
  monthName: string;
}) {
  const [draft, setDraft] = useState<Draft>(() =>
    Object.fromEntries(data.rows.map((r) => [r.studentId, { amount: r.amount ? String(r.amount) : "", note: r.note }])),
  );
  const save = useAction(saveCollectionAction, { successMessage: "حُفظت المسودة" });
  const send = useAction(saveCollectionAction, { successMessage: "أُرسلت القائمة للمحاسب" });
  const pending = save.pending || send.pending;

  // Confirmed lines are final; everything else is the teacher's to edit until the list is sent.
  const isFixed = (state: string | null) => data.locked || state === "OK";
  const editable = data.rows.filter((r) => !isFixed(r.state));
  const lines = editable.map((r) => ({
    studentId: r.studentId,
    amount: Number(draft[r.studentId]?.amount) || 0,
    note: draft[r.studentId]?.note.trim() ?? "",
  }));
  const filled = lines.filter((l) => l.amount > 0 || l.note !== "");
  const filledTotal = filled.reduce((sum, l) => sum + l.amount, 0);
  const total = data.rows.reduce(
    (sum, r) => sum + (isFixed(r.state) ? (r.amount ?? 0) : Number(draft[r.studentId]?.amount) || 0),
    0,
  );

  const set = (studentId: string, patch: Partial<Draft[string]>) =>
    setDraft((d) => ({ ...d, [studentId]: { ...d[studentId], ...patch } }));
  const submit = (toAccountant: boolean) =>
    (toAccountant ? send : save).execute({ halaqaId: data.halaqaId, year, month, lines, send: toAccountant });

  if (data.rows.length === 0) return <EmptyState icon={UsersIcon} title="لا يوجد طلاب في هذه الحلقة." />;

  return (
    <div className="flex flex-col gap-4">
      <Banner data={data} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>الطالب</TableHead>
            <TableHead>المستحق</TableHead>
            <TableHead>المحصَّل</TableHead>
            <TableHead>ملاحظة</TableHead>
            <TableHead>الحالة</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.rows.map((row, index) => {
            const fixed = isFixed(row.state);
            return (
              <TableRow key={row.studentId} className={row.state === "ISSUE" ? "bg-destructive/10" : undefined}>
                <TableCell dir="ltr" className="text-end text-muted-foreground">
                  {index + 1}
                </TableCell>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell dir="ltr" className="text-end">
                  {row.due == null ? "—" : formatMoney(row.due)}
                </TableCell>
                <TableCell>
                  {fixed ? (
                    <span dir="ltr">{formatMoney(row.amount)}</span>
                  ) : (
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      dir="ltr"
                      className="w-28"
                      aria-label={`المحصَّل من ${row.name}`}
                      value={draft[row.studentId]?.amount ?? ""}
                      onChange={(e) => set(row.studentId, { amount: e.target.value })}
                    />
                  )}
                </TableCell>
                <TableCell className="whitespace-normal">
                  {fixed ? (
                    row.note
                  ) : (
                    <Input
                      className="min-w-40"
                      maxLength={300}
                      placeholder="اختياري"
                      aria-label={`ملاحظة ${row.name}`}
                      value={draft[row.studentId]?.note ?? ""}
                      onChange={(e) => set(row.studentId, { note: e.target.value })}
                    />
                  )}
                </TableCell>
                <TableCell className="whitespace-normal">
                  {row.state && <LineStateBadge state={row.state} />}
                  {row.accountantNote && <div className="mt-1 text-xs text-destructive">{row.accountantNote}</div>}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={3}>الإجمالي</TableCell>
            <TableCell dir="ltr" className="text-end">
              {formatMoney(total)}
            </TableCell>
            <TableCell colSpan={2} />
          </TableRow>
        </TableFooter>
      </Table>

      {!data.locked && (
        <div className="no-print flex flex-wrap gap-2">
          {filled.length > 0 ? (
            <ConfirmDialog
              title={`إرسال قائمة ${monthName} للمحاسب؟`}
              description={`${filled.length} طالبًا، ${formatMoney(filledTotal)} ${CURRENCY_LABEL}. لن يمكن تعديلها حتى يراجعها.`}
              confirmLabel="إرسال"
              onConfirm={() => submit(true)}
            >
              <Button disabled={pending}>
                {send.pending ? <Spinner /> : <SendIcon />}
                إرسال للمحاسب
              </Button>
            </ConfirmDialog>
          ) : (
            <Button disabled={pending} onClick={() => toast.error("اكتب ما حصّلته أولًا")}>
              <SendIcon />
              إرسال للمحاسب
            </Button>
          )}
          <Button variant="outline" disabled={pending} onClick={() => submit(false)}>
            {save.pending ? <Spinner /> : <SaveIcon />}
            حفظ مسودة
          </Button>
        </div>
      )}
    </div>
  );
}
