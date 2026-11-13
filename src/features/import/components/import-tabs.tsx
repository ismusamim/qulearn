import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const IMPORT_TABS = [
  { key: "members", label: "استيراد الأعضاء" },
  { key: "pending", label: "بيانات معلّقة" },
  { key: "fields", label: "الحقول الإضافية" },
  { key: "backup", label: "نسخة احتياطية" },
] as const;

export type ImportTab = (typeof IMPORT_TABS)[number]["key"];

export function parseImportTab(value: string | string[] | undefined): ImportTab {
  return IMPORT_TABS.find((t) => t.key === value)?.key ?? "members";
}

/** Tab bar; the active tab lives in the URL so it survives a reload. */
export function ImportTabs({ active, pendingCount }: { active: ImportTab; pendingCount: number }) {
  return (
    <nav className="no-print mb-6 flex flex-wrap gap-2" aria-label="أقسام الاستيراد والبيانات">
      {IMPORT_TABS.map((tab) => (
        <Button key={tab.key} asChild size="sm" variant={tab.key === active ? "default" : "outline"}>
          <Link href={tab.key === "members" ? "/import" : `/import?tab=${tab.key}`} aria-current={tab.key === active ? "page" : undefined}>
            {tab.label}
            {tab.key === "pending" && pendingCount > 0 && <Badge variant="secondary">{pendingCount}</Badge>}
          </Link>
        </Button>
      ))}
    </nav>
  );
}
