import { CURRENCY_LABEL } from "@/lib/constants";
import { formatMoney } from "@/lib/format";

import type { FeeSummary } from "../summary";

function Stat({ value, label, tone }: { value: string | number; label: string; tone?: string }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <div className={`text-lg font-bold ${tone ?? "text-primary"}`} dir="ltr">
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

/** Month totals over every student matching the search (not only the rows shown). */
export function FeesSummary({ summary, monthName }: { summary: FeeSummary; monthName: string }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <Stat value={formatMoney(summary.expected)} label={`المتوقع (${CURRENCY_LABEL})`} />
      <Stat value={formatMoney(summary.collected)} label={`المحصَّل في ${monthName}`} tone="text-success" />
      <Stat value={formatMoney(summary.outstanding)} label="المتبقي" tone="text-destructive" />
      <Stat value={summary.paidCount} label="مسدَّد" />
      <Stat value={summary.partialCount} label="جزئي" />
      <Stat value={summary.unpaidCount} label="لم يُسدَّد" />
      {summary.exemptCount > 0 && <Stat value={summary.exemptCount} label="معفى" />}
      {summary.droppedCount > 0 && <Stat value={summary.droppedCount} label="منقطع" />}
    </div>
  );
}
