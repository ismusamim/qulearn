import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * A sample of the elements each colour drives. It uses theme tokens only, so it
 * follows the editor's live preview without receiving the colours itself.
 */
export function ThemePreview() {
  return (
    <div className="overflow-hidden rounded-lg border" aria-label="معاينة">
      <div className="flex items-center justify-between gap-2 bg-sidebar px-3 py-2 text-sidebar-foreground">
        <span className="text-sm font-semibold">معاينة</span>
        <span className="rounded-md bg-sidebar-primary px-2 py-0.5 text-xs text-sidebar-primary-foreground">التبويب النشط</span>
      </div>
      <div className="flex flex-col gap-3 bg-background p-3 text-foreground">
        <div className="rounded-lg border border-s-4 border-s-gold bg-card p-3">
          <p className="font-semibold text-primary">عنوان البطاقة</p>
          <p className="text-sm">نص عادي كما يظهر في الصفحات.</p>
          <p className="text-sm text-muted-foreground">نص ثانوي أخف.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" tabIndex={-1}>
            زر أساسي
          </Button>
          <Button type="button" size="sm" variant="secondary" tabIndex={-1}>
            زر ثانوي
          </Button>
          <Button type="button" size="sm" variant="destructive" tabIndex={-1}>
            حذف
          </Button>
          <span className="rounded-md bg-success px-2 py-1 text-xs font-medium text-white">حاضر</span>
          <span className="rounded-md bg-warning px-2 py-1 text-xs font-medium text-white">متأخر</span>
          <span className="rounded-md bg-warning/15 px-2 py-1 text-xs font-medium text-warning">معتذر</span>
          <span className="rounded-md bg-destructive px-2 py-1 text-xs font-medium text-white">غائب</span>
          <Badge variant="secondary">شارة</Badge>
        </div>
      </div>
    </div>
  );
}
