"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { CalendarPlusIcon, LockIcon, LockOpenIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PrintButton } from "@/components/shared/print-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import { monthName } from "@/lib/dates";

import {
  closeMonthAction,
  createMonthAction,
  deleteMonthAction,
  removeRowAction,
  reopenMonthAction,
  updateRowAction,
} from "../actions";
import { type RowInputs, sumNet } from "../calc";
import { type InputKey, formatAmount } from "../constants";
import type { MonthSheetDTO, PayrollRowDTO } from "../service";
import { AddRowDialog } from "./add-row-dialog";
import { MonthGrid } from "./month-grid";
import { PeriodSelect } from "./period-select";

/** How long after the last keystroke a row is saved. */
const SAVE_DELAY_MS = 700;

/**
 * One month of the payroll ledger. Mount with `key={year-month}` so local
 * edits never leak from one month into another.
 */
export function MonthSheet({ sheet, years }: { sheet: MonthSheetDTO; years: number[] }) {
  const { year, month, closed, rows, rules } = sheet;
  const period = { year, month };

  // Edits made in this session, on top of what the server sent. Kept after saving:
  // they equal the stored values, and the server copy may arrive while the user is still typing.
  const [edits, setEdits] = useState<Record<string, RowInputs>>({});
  const [saving, setSaving] = useState(0);
  const latest = useRef<Record<string, RowInputs>>({});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const valuesOf = (row: PayrollRowDTO) => edits[row.id] ?? row.values;

  const flush = useCallback(async (rowId: string) => {
    const timer = timers.current.get(rowId);
    if (!timer) return;
    clearTimeout(timer);
    timers.current.delete(rowId);
    setSaving((n) => n + 1);
    const result = await updateRowAction({ id: rowId, values: latest.current[rowId] });
    setSaving((n) => n - 1);
    if (!result.ok) toast.error(result.error);
  }, []);

  const flushAll = useCallback(() => {
    for (const rowId of [...timers.current.keys()]) void flush(rowId);
  }, [flush]);

  // Leaving the sheet must not drop the last keystrokes.
  useEffect(() => flushAll, [flushAll]);

  const onCellChange = (rowId: string, key: InputKey, value: number | null) => {
    const base = latest.current[rowId] ?? rows.find((r) => r.id === rowId)?.values;
    if (!base) return;
    const next = { ...base, [key]: value };
    latest.current[rowId] = next;
    setEdits((all) => ({ ...all, [rowId]: next }));
    clearTimeout(timers.current.get(rowId));
    timers.current.set(rowId, setTimeout(() => void flush(rowId), SAVE_DELAY_MS));
  };

  const create = useAction(createMonthAction, {
    onSuccess: ({ count }) => toast.success(`تم إنشاء شهر (${month}) ${year} لـ ${count} موظف`),
  });
  const close = useAction(closeMonthAction, { successMessage: "تم إغلاق الشهر" });
  const reopen = useAction(reopenMonthAction, { successMessage: "أُعيد فتح الشهر" });
  const removeMonth = useAction(deleteMonthAction, { successMessage: "تم حذف كشف الشهر" });
  const removeRow = useAction(removeRowAction, { successMessage: "تم حذف الصف" });

  const total = sumNet(rows.map(valuesOf), rules);
  const title = `${monthName(month)} (${month}) ${year}`;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <PeriodSelect years={years} year={year} month={month} />
          <span className="grow" />
          {rows.length > 0 && (
            <>
              {!closed && (
                <span className="no-print flex items-center gap-1 text-xs text-muted-foreground" aria-live="polite">
                  {saving > 0 ? (
                    <>
                      <Spinner /> جارٍ الحفظ…
                    </>
                  ) : Object.keys(edits).length > 0 ? (
                    "تم الحفظ"
                  ) : null}
                </span>
              )}
              <Badge variant="secondary">{rows.length} موظف</Badge>
              <Badge variant="outline">
                الإجمالي: <b dir="ltr">{formatAmount(total)}</b>
              </Badge>
              {closed && (
                <Badge>
                  <LockIcon /> مغلق
                </Badge>
              )}
            </>
          )}
        </div>

        <div className="no-print flex flex-wrap items-center gap-2">
          {rows.length === 0 ? (
            <Button onClick={() => create.execute(period)} disabled={create.pending || closed}>
              {create.pending ? <Spinner /> : <CalendarPlusIcon />}
              إنشاء الشهر من الموظفين النشطين
            </Button>
          ) : closed ? (
            <ConfirmDialog title="إعادة فتح الشهر للتعديل؟" confirmLabel="إعادة فتح" onConfirm={() => reopen.execute(period)}>
              <Button variant="outline" disabled={reopen.pending}>
                <LockOpenIcon />
                إعادة فتح الشهر
              </Button>
            </ConfirmDialog>
          ) : (
            <>
              <AddRowDialog year={year} month={month} options={sheet.addable}>
                <Button variant="outline">
                  <PlusIcon />
                  موظف لهذا الشهر
                </Button>
              </AddRowDialog>
              <ConfirmDialog
                title={`إغلاق شهر (${month}) ${year}؟`}
                description="لن يمكن تعديله إلا بإعادة فتحه."
                confirmLabel="إغلاق الشهر"
                onConfirm={() => {
                  // Pending edits are sent first; actions run in the order they were dispatched.
                  flushAll();
                  close.execute(period);
                }}
              >
                <Button disabled={close.pending}>
                  <LockIcon />
                  إغلاق الشهر
                </Button>
              </ConfirmDialog>
              <ConfirmDialog
                title={`حذف كشف شهر (${month}) ${year} بالكامل؟`}
                description="تُحذف كل صفوف هذا الشهر. لا يمكن التراجع."
                confirmLabel="حذف الشهر"
                destructive
                onConfirm={() => {
                  for (const timer of timers.current.values()) clearTimeout(timer);
                  timers.current.clear();
                  removeMonth.execute(period);
                }}
              >
                <Button variant="destructive" disabled={removeMonth.pending}>
                  <Trash2Icon />
                  حذف الشهر
                </Button>
              </ConfirmDialog>
            </>
          )}
          {rows.length > 0 && <PrintButton label="طباعة الكشف" />}
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="لا يوجد كشف لهذا الشهر بعد"
            description="«إنشاء الشهر» يجهّز صفًا لكل موظف نشط بأسعاره الحالية، وينقل الساعات الإضافية من الشهر السابق."
          />
        ) : (
          <>
            <h2 className="hidden text-center text-lg font-bold print:block">كشف رواتب معلمي القرآن الكريم - {title}</h2>
            {!closed && (
              <p className="no-print rounded-lg border border-gold/40 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                الخلايا قابلة للتعديل والراتب يُحسب فورًا. الخصومات تُكتب مبالغ موجبة. «إغلاق الشهر» يمنع التعديل ويحفظه في
                الأرشيف.
              </p>
            )}
            <MonthGrid
              rows={rows}
              valuesOf={valuesOf}
              rules={rules}
              closed={closed}
              onCellChange={onCellChange}
              onCellBlur={(rowId) => void flush(rowId)}
              onRemove={(rowId) => {
                clearTimeout(timers.current.get(rowId));
                timers.current.delete(rowId);
                removeRow.execute({ id: rowId });
              }}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
