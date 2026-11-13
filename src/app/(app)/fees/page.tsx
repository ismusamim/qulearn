import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { PrintButton } from "@/components/shared/print-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeeConfig } from "@/features/fees/components/fee-config";
import { FeesFilters } from "@/features/fees/components/fees-filters";
import { FeesSummary } from "@/features/fees/components/fees-summary";
import { FeesTable } from "@/features/fees/components/fees-table";
import { FeesTabs } from "@/features/fees/components/fees-tabs";
import { getFeeConfig } from "@/features/fees/config-service";
import { currentYearMonth, monthKey, monthLabel, monthOptionsWith, parseMonthKey } from "@/features/fees/months";
import { feeFiltersSchema } from "@/features/fees/schemas";
import { getFeesOverview } from "@/features/fees/service";
import { monthName } from "@/lib/dates";
import { canAny, hasRole, requirePage } from "@/server/auth";

export const metadata: Metadata = { title: "الاشتراكات" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const text = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

export default async function FeesPage(props: { searchParams: SearchParams }) {
  const auth = await requirePage((a) => canAny(a, "fees.collect", "fees.amount"));
  const params = await props.searchParams;
  const isAdmin = hasRole(auth, "ADMIN");

  const today = currentYearMonth();
  const month = parseMonthKey(text(params.month), today);
  const tab = isAdmin && text(params.tab) === "config" ? "config" : "collect";
  const parsed = feeFiltersSchema.safeParse({ qs: text(params.qs), qh: text(params.qh), qp: text(params.qp) });
  const filters = parsed.success ? parsed.data : { qs: "", qh: "", qp: "" };
  // Like the legacy page: a year back and two months ahead.
  const months = monthOptionsWith(month, today, -12, 2).map((m) => ({ value: monthKey(m), label: monthLabel(m) }));

  const config = await getFeeConfig(auth);

  return (
    <>
      <PageHeader title="الاشتراكات" description="تحصيل اشتراكات الطلاب: كل دفعة سجلّ مستقل بالطالب والشهر والمبلغ ومن حصّلها.">
        {tab === "collect" && <PrintButton />}
      </PageHeader>
      {isAdmin && <FeesTabs active={tab} month={monthKey(month)} />}
      {tab === "config" ? (
        <FeeConfig config={config} />
      ) : (
        <CollectTab month={month} months={months} filters={filters} config={config} overview={await getFeesOverview(auth, month, filters)} />
      )}
    </>
  );
}

function CollectTab({
  month,
  months,
  filters,
  config,
  overview,
}: Pick<React.ComponentProps<typeof FeesTable>, "month" | "months" | "filters" | "config" | "overview">) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>تحصيل اشتراكات الطلاب — {monthLabel(month)}</CardTitle>
        <CardDescription>
          المستحق = مبلغ فئة الطالب (أو الفئة الافتراضية لسنّه، أو مبلغه الخاص) مطروحًا منه خصمه إن وُجد.
          {config.categories.length === 0 && <b> ابدأ بإضافة الفئات من «الفئات والخصومات».</b>}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FeesFilters month={monthKey(month)} months={months} filters={filters} />
        {overview.summary && <FeesSummary summary={overview.summary} monthName={monthName(month.month)} />}
        <FeesTable
          // Dialog state belongs to one month + search; a new result set starts clean.
          key={`${monthKey(month)}|${filters.qs}|${filters.qh}|${filters.qp}`}
          overview={overview}
          config={config}
          month={month}
          months={months}
          filters={filters}
        />
      </CardContent>
    </Card>
  );
}
