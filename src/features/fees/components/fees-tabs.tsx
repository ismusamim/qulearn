import Link from "next/link";

import { cn } from "@/lib/utils";

import { feesHref, type FeesTab } from "../url";

const TABS: ReadonlyArray<{ value: FeesTab; label: string }> = [
  { value: "collect", label: "التحصيل" },
  { value: "config", label: "الفئات والخصومات" },
];

/** Tab bar driven by the `tab` search param, so the open tab survives a reload. */
export function FeesTabs({ active, month }: { active: FeesTab; month: string }) {
  return (
    <nav className="no-print mb-4 inline-flex w-fit items-center rounded-lg bg-muted p-[3px] text-sm" aria-label="أقسام الاشتراكات">
      {TABS.map((tab) => (
        <Link
          key={tab.value}
          href={feesHref({ tab: tab.value, month })}
          aria-current={tab.value === active ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1 font-medium text-muted-foreground transition-colors hover:text-foreground",
            tab.value === active && "bg-background text-foreground shadow-sm",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
