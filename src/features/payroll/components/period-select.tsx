"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { MONTHS_AR } from "@/lib/dates";

import { monthLabel } from "../constants";

/**
 * Year (and optionally month) selectors that keep the choice in the URL, so it
 * survives reloads and can be linked to.
 */
export function PeriodSelect({
  years,
  year,
  month,
  allMonths = false,
  yearParam = "y",
  monthParam = "m",
}: {
  years: number[];
  year: number;
  /** Omit to show the year only. 0 = «كل الشهور» when `allMonths` is set. */
  month?: number;
  allMonths?: boolean;
  yearParam?: string;
  monthParam?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const go = (param: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set(param, value);
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <div className="no-print flex items-center gap-2">
      <NativeSelect aria-label="السنة" dir="ltr" value={year} onChange={(e) => go(yearParam, e.target.value)}>
        {years.map((y) => (
          <NativeSelectOption key={y} value={y}>
            {y}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {month !== undefined && (
        <NativeSelect aria-label="الشهر" value={month} onChange={(e) => go(monthParam, e.target.value)}>
          {allMonths && <NativeSelectOption value={0}>كل الشهور</NativeSelectOption>}
          {MONTHS_AR.map((name, i) => (
            <NativeSelectOption key={name} value={i + 1}>
              {monthLabel(i + 1, name)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      )}
    </div>
  );
}
