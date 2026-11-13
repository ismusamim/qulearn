import { CircleIcon } from "lucide-react";
import Link from "next/link";

import { NAV_ICONS } from "@/components/layout/nav-icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ResolvedNavItem } from "@/lib/navigation";

/** Shortcuts to the main sections — the same items as the sidebar, so they never drift apart. */
export function QuickLinks({ items }: { items: ResolvedNavItem[] }) {
  return (
    <Card className="no-print">
      <CardHeader>
        <CardTitle>الأقسام</CardTitle>
      </CardHeader>
      <CardContent>
        <nav aria-label="روابط سريعة" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {items.map((item) => {
            const Icon = NAV_ICONS[item.icon] ?? CircleIcon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 rounded-lg border px-3 py-2.5 font-medium transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Icon className="size-4 shrink-0 text-gold" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </CardContent>
    </Card>
  );
}
