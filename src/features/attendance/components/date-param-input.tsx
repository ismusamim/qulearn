"use client";

import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type ISODate, isISODate, todayISO, weekdayName } from "@/lib/dates";

/** Date picker bound to the `date` search param. */
export function DateParamInput({ value }: { value: ISODate }) {
  const router = useRouter();
  const pathname = usePathname();

  const change = (next: string) => {
    if (!isISODate(next)) return;
    const params = new URLSearchParams(window.location.search);
    params.set("date", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        type="date"
        dir="ltr"
        className="w-40"
        aria-label="التاريخ"
        value={value}
        onChange={(e) => change(e.target.value)}
      />
      <span className="text-sm text-muted-foreground">{weekdayName(value)}</span>
      {/* The browser's "today" may differ from the server's around midnight; the button uses the user's. */}
      <Button type="button" variant="outline" size="sm" onClick={() => change(todayISO())}>
        اليوم
      </Button>
    </div>
  );
}
