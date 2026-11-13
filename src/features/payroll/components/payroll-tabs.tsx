import Link from "next/link";

import { Button } from "@/components/ui/button";

import { PAYROLL_TABS, type PayrollTab } from "../constants";

/** Section switcher. The selected year and month travel with the link. */
export function PayrollTabs({ active, year, month }: { active: PayrollTab; year: number; month: number }) {
  return (
    <nav className="no-print mb-4 flex flex-wrap gap-2" aria-label="أقسام المرتبات">
      {PAYROLL_TABS.map((tab) => (
        <Button key={tab.key} asChild size="sm" variant={tab.key === active ? "default" : "outline"}>
          <Link href={`/payroll?tab=${tab.key}&y=${year}&m=${month}`} aria-current={tab.key === active ? "page" : undefined}>
            {tab.label}
          </Link>
        </Button>
      ))}
    </nav>
  );
}
