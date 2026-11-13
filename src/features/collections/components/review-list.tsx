import Link from "next/link";

import { ClipboardListIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { monthName } from "@/lib/dates";
import { formatMoney } from "@/lib/format";

import type { CollectionSummaryDTO } from "../service";
import { CollectionStatusBadge } from "./collection-badges";

export function ReviewList({ collections }: { collections: CollectionSummaryDTO[] }) {
  if (collections.length === 0) return <EmptyState icon={ClipboardListIcon} title="لا توجد قوائم هنا." />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>#</TableHead>
          <TableHead>المعلم</TableHead>
          <TableHead>الحلقة</TableHead>
          <TableHead>الشهر</TableHead>
          <TableHead>الطلاب</TableHead>
          <TableHead>الإجمالي</TableHead>
          <TableHead>الحالة</TableHead>
          <TableHead className="w-0" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {collections.map((c, index) => (
          <TableRow key={c.id}>
            <TableCell dir="ltr" className="text-end text-muted-foreground">
              {index + 1}
            </TableCell>
            <TableCell className="font-medium">{c.teacherName}</TableCell>
            <TableCell>{c.halaqaLabel ?? "—"}</TableCell>
            <TableCell>
              {monthName(c.month)} <span dir="ltr">{c.year}</span>
            </TableCell>
            <TableCell dir="ltr" className="text-end">
              {c.lineCount}
            </TableCell>
            <TableCell dir="ltr" className="text-end">
              {formatMoney(c.total)}
            </TableCell>
            <TableCell>
              <CollectionStatusBadge status={c.status} />
            </TableCell>
            <TableCell>
              <Button asChild size="sm" variant={c.status === "SENT" ? "default" : "outline"}>
                <Link href={`/collections/review/${c.id}`}>{c.status === "SENT" ? "مراجعة" : "عرض"}</Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
