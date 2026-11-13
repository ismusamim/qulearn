import { Card, CardContent } from "@/components/ui/card";
import { formatRate } from "@/features/attendance/stats";

import { lastHifzText } from "../progress";
import type { StudentRecordDTO } from "../service";

/** The four headline figures of a student's record. */
export function StudentStats({ stats }: { stats: StudentRecordDTO["stats"] }) {
  const items: { label: string; value: string; ltr?: boolean }[] = [
    { label: "آخر موضع حفظ", value: lastHifzText(stats.lastHifz) },
    { label: "آيات مسجّلة حفظًا", value: String(stats.hifzAyat), ltr: true },
    { label: "نسبة الحضور", value: formatRate(stats.attendanceRate), ltr: true },
    { label: "عدد التسميعات", value: String(stats.recitationCount), ltr: true },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} size="sm">
          <CardContent className="flex flex-col gap-1">
            <b className="text-lg text-primary">{item.ltr ? <span dir="ltr">{item.value}</span> : item.value}</b>
            <span className="text-xs text-muted-foreground">{item.label}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** «الحلقة … — المكان … — الوقت … — المعلم …» */
export function HalaqaLine({ student }: { student: StudentRecordDTO["student"] }) {
  const parts = [
    `الحلقة: ${student.halaqaLabel ?? "غير محدد"}`,
    `المكان: ${student.placeName || "—"}`,
    student.schedule ? `الوقت: ${student.schedule}` : "",
    `المعلم: ${student.teacherName ?? "—"}`,
  ].filter(Boolean);
  return <>{parts.join(" — ")}</>;
}
