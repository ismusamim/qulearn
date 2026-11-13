import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { ArchiveTable } from "@/features/payroll/components/archive-table";
import { EmployeesTable } from "@/features/payroll/components/employees-table";
import { LeaveOverview } from "@/features/payroll/components/leave-overview";
import { MonthSheet } from "@/features/payroll/components/month-sheet";
import { PayrollTabs } from "@/features/payroll/components/payroll-tabs";
import { PinGate } from "@/features/payroll/components/pin-gate";
import { SettingsPanel } from "@/features/payroll/components/settings-panel";
import { YearSummaryCard } from "@/features/payroll/components/year-summary";
import { type PayrollTab, isPayrollTab } from "@/features/payroll/constants";
import { getEmployeesOverview } from "@/features/payroll/employees-service";
import { getArchive, getLeaveOverview, getYearSummary } from "@/features/payroll/reports-service";
import { getMonthSheet, getPayrollPeriods, getPayrollSettings, isPayrollLocked } from "@/features/payroll/service";
import { type AuthContext, hasRole, requirePage } from "@/server/auth";

export const metadata: Metadata = { title: "المرتبات" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** A whole number within [min, max] from a query parameter, or null. */
function intParam(value: string | string[] | undefined, min: number, max: number): number | null {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

async function Section({
  auth,
  tab,
  year,
  month,
  allMonth,
  years,
}: {
  auth: AuthContext;
  tab: PayrollTab;
  year: number;
  month: number;
  allMonth: number;
  years: number[];
}) {
  switch (tab) {
    case "employees":
      return <EmployeesTable overview={await getEmployeesOverview(auth)} />;
    case "year":
      return <YearSummaryCard year={year} years={years} summary={await getYearSummary(auth, year)} />;
    case "archive":
      return <ArchiveTable years={await getArchive(auth)} />;
    case "leave":
      return <LeaveOverview years={years} overview={await getLeaveOverview(auth, year, allMonth)} />;
    case "settings":
      return <SettingsPanel settings={await getPayrollSettings(auth)} />;
    default:
      // Keyed by month so unsaved-edit state never carries over to another sheet.
      return <MonthSheet key={`${year}-${month}`} years={years} sheet={await getMonthSheet(auth, { year, month })} />;
  }
}

export default async function PayrollPage(props: { searchParams: SearchParams }) {
  const auth = await requirePage((a) => hasRole(a, "ADMIN"));

  if (await isPayrollLocked(auth)) {
    return (
      <>
        <PageHeader title="المرتبات" />
        <PinGate />
      </>
    );
  }

  const [params, periods] = await Promise.all([props.searchParams, getPayrollPeriods(auth)]);
  const tab = isPayrollTab(params.tab) ? params.tab : "month";
  const year = intParam(params.y, 2000, 2100) ?? periods.latest.year;
  const month = intParam(params.m, 1, 12) ?? periods.latest.month;
  const years = periods.years.includes(year) ? periods.years : [...periods.years, year].sort((a, b) => b - a);

  return (
    <>
      <PageHeader title="المرتبات" description="كل الشهور والسنوات في سجل واحد؛ الكشف يُعرض باختيار السنة والشهر." />
      <PayrollTabs active={tab} year={year} month={month} />
      <Section auth={auth} tab={tab} year={year} month={month} allMonth={intParam(params.am, 0, 12) ?? 0} years={years} />
    </>
  );
}
