"use client";

import { Trash2Icon } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { type PayrollRules, type RowInputs, calcRow } from "../calc";
import { INPUT_FIELDS, INPUT_GROUPS, type InputKey, formatAmount, formatHours } from "../constants";
import type { PayrollRowDTO } from "../service";

const cellInput =
  "h-7 w-16 rounded-md border border-input bg-transparent px-1 text-center text-sm tabular-nums outline-none " +
  "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 print:w-12 print:border-0 " +
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

/** Hours and absence counts keep fractions; money is shown rounded. */
const show = (key: InputKey, value: number | null) =>
  INPUT_FIELDS.find((f) => f.key === key)?.group === "hours" || INPUT_FIELDS.find((f) => f.key === key)?.group === "absence"
    ? formatHours(value)
    : formatAmount(value);

const head = "border-s text-center whitespace-nowrap";
const sticky = "sticky start-0 z-10 bg-card";

function parseCell(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/** Column totals. A total of hourly rates means nothing, so that column stays empty. */
function totals(rows: RowInputs[], rules: PayrollRules) {
  const inputs = Object.fromEntries(INPUT_FIELDS.map((f) => [f.key, 0])) as Record<InputKey, number>;
  const result = { actualHours: 0, overtimeAmount: 0, deductions: 0, net: 0 };
  for (const values of rows) {
    for (const f of INPUT_FIELDS) inputs[f.key] += values[f.key] ?? 0;
    const c = calcRow(values, rules);
    result.actualHours += c.actualHours;
    result.overtimeAmount += c.overtimeAmount;
    result.deductions += c.deductions;
    result.net += c.net;
  }
  return { inputs, result };
}

/**
 * The month sheet. Open months are edited in place and every result is
 * recomputed as the user types; closed months are plain text.
 */
export function MonthGrid({
  rows,
  valuesOf,
  rules,
  closed,
  onCellChange,
  onCellBlur,
  onRemove,
}: {
  rows: PayrollRowDTO[];
  valuesOf: (row: PayrollRowDTO) => RowInputs;
  rules: PayrollRules;
  closed: boolean;
  onCellChange: (rowId: string, key: InputKey, value: number | null) => void;
  onCellBlur: (rowId: string) => void;
  onRemove: (rowId: string) => void;
}) {
  const sum = totals(rows.map(valuesOf), rules);

  return (
    <Table className="text-sm">
      <TableHeader>
        <TableRow>
          <TableHead rowSpan={2} className="text-center">
            م
          </TableHead>
          <TableHead rowSpan={2} className={sticky}>
            الاسم
          </TableHead>
          <TableHead rowSpan={2}>الوظيفة</TableHead>
          {INPUT_GROUPS.map((g) => (
            <TableHead key={g.key} colSpan={INPUT_FIELDS.filter((f) => f.group === g.key).length} className={head}>
              {g.label}
            </TableHead>
          ))}
          <TableHead colSpan={4} className={head}>
            النتيجة
          </TableHead>
          {!closed && <TableHead rowSpan={2} className="no-print w-0" />}
        </TableRow>
        <TableRow>
          {INPUT_FIELDS.map((f) => (
            <TableHead key={f.key} className={`${head} text-xs`}>
              {f.label}
            </TableHead>
          ))}
          <TableHead className={`${head} text-xs`}>الساعات الفعلية</TableHead>
          <TableHead className={`${head} text-xs`}>مبلغ الإضافي</TableHead>
          <TableHead className={`${head} text-xs`}>إجمالي الخصم</TableHead>
          <TableHead className={`${head} text-xs`}>الراتب</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => {
          const values = valuesOf(row);
          const c = calcRow(values, rules);
          return (
            <TableRow key={row.id}>
              <TableCell className="text-center text-muted-foreground">{i + 1}</TableCell>
              <TableCell className={`${sticky} font-medium whitespace-nowrap`}>{row.name}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{row.jobTitle}</TableCell>
              {INPUT_FIELDS.map((f) => (
                <TableCell key={f.key} className="border-s p-1 text-center tabular-nums" dir="ltr">
                  {closed ? (
                    show(f.key, values[f.key])
                  ) : (
                    <input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      className={cellInput}
                      aria-label={`${f.label} — ${row.name}`}
                      // Uncontrolled: the browser keeps half-typed numbers ("1.") intact.
                      defaultValue={row.values[f.key] ?? ""}
                      onChange={(e) => onCellChange(row.id, f.key, parseCell(e.target.value))}
                      onBlur={() => onCellBlur(row.id)}
                    />
                  )}
                </TableCell>
              ))}
              <TableCell className="border-s text-center tabular-nums" dir="ltr">
                {formatHours(c.actualHours)}
              </TableCell>
              <TableCell className="border-s text-center tabular-nums" dir="ltr">
                {formatAmount(c.overtimeAmount)}
              </TableCell>
              <TableCell className="border-s text-center tabular-nums text-destructive" dir="ltr">
                {formatAmount(c.deductions)}
              </TableCell>
              <TableCell className="border-s text-center font-bold tabular-nums text-primary" dir="ltr">
                {formatAmount(c.net)}
              </TableCell>
              {!closed && (
                <TableCell className="no-print p-1">
                  <ConfirmDialog
                    title="حذف هذا الصف من الشهر؟"
                    description={`يخرج «${row.name}» من كشف هذا الشهر فقط، ويبقى في سجل الموظفين.`}
                    confirmLabel="حذف"
                    destructive
                    onConfirm={() => onRemove(row.id)}
                  >
                    <Button variant="ghost" size="icon-sm" aria-label={`حذف صف ${row.name}`}>
                      <Trash2Icon className="text-destructive" />
                    </Button>
                  </ConfirmDialog>
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
      <TableFooter>
        <TableRow className="font-bold">
          <TableCell colSpan={3} className={sticky}>
            الإجمالي
          </TableCell>
          {INPUT_FIELDS.map((f) => (
            <TableCell key={f.key} className="border-s text-center tabular-nums" dir="ltr">
              {f.key === "rate" ? "" : show(f.key, sum.inputs[f.key])}
            </TableCell>
          ))}
          <TableCell className="border-s text-center tabular-nums" dir="ltr">
            {formatHours(sum.result.actualHours)}
          </TableCell>
          <TableCell className="border-s text-center tabular-nums" dir="ltr">
            {formatAmount(sum.result.overtimeAmount)}
          </TableCell>
          <TableCell className="border-s text-center tabular-nums" dir="ltr">
            {formatAmount(sum.result.deductions)}
          </TableCell>
          <TableCell className="border-s text-center tabular-nums text-primary" dir="ltr">
            {formatAmount(sum.result.net)}
          </TableCell>
          {!closed && <TableCell className="no-print" />}
        </TableRow>
      </TableFooter>
    </Table>
  );
}
