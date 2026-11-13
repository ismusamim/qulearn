import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";

import type { FeeState } from "../summary";

/** The student's standing for the selected month. */
export function FeeStateBadge({ state, paid, remaining }: { state: FeeState; paid: number; remaining: number }) {
  switch (state) {
    case "DROPPED":
      return (
        <span className="inline-flex flex-wrap items-center gap-1">
          <Badge variant="destructive">منقطع</Badge>
          {paid > 0 && (
            <small className="text-muted-foreground">
              دفع <span dir="ltr">{formatMoney(paid)}</span>
            </small>
          )}
        </span>
      );
    case "EXEMPT":
      return <Badge className="bg-success/15 text-success">معفى</Badge>;
    case "PAID":
      return <Badge className="bg-success/15 text-success">مسدَّد ✓</Badge>;
    case "PARTIAL":
      return (
        <Badge variant="outline" className="text-warning">
          جزئي: باقٍ <span dir="ltr">{formatMoney(remaining)}</span>
        </Badge>
      );
    case "UNPAID":
      return <Badge variant="destructive">لم يُسدَّد</Badge>;
    case "PAID_NO_FEE":
      return <Badge className="bg-success/15 text-success">مدفوع</Badge>;
    case "NO_FEE":
      return <span className="text-muted-foreground">بلا اشتراك محدد</span>;
  }
}
