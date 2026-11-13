import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";

import type { DashboardDTO } from "../service";

/** The headline numbers; each tile opens the section it counts. */
export function StatCards({ data }: { data: DashboardDTO }) {
  const { counts, attendance, weekRecitations } = data;
  const stats: Array<{ value: string | number; label: string; href: string; hint?: string }> = [
    { value: counts.teachers, label: "معلم", href: "/teachers" },
    { value: counts.supervisors, label: "مشرف", href: "/members" },
    { value: counts.places, label: "مكان", href: "/halaqat" },
    { value: counts.halaqat, label: "حلقة", href: "/halaqat" },
    {
      value: counts.students,
      label: "طالب",
      href: "/students",
      hint: counts.droppedStudents ? `منهم ${counts.droppedStudents} منقطع` : undefined,
    },
    { value: attendance.rate === null ? "—" : `${attendance.rate}%`, label: "حضور اليوم", href: "/attendance" },
    { value: weekRecitations, label: "تسجيلات الأسبوع", href: "/my-students" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      {stats.map((stat) => (
        <Link key={stat.label} href={stat.href} className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <Card size="sm" className="h-full border-t-2 border-gold transition-colors hover:bg-muted/50">
            <CardContent className="flex flex-col items-center gap-0.5 text-center">
              <b dir="ltr" className="text-2xl font-bold text-primary tabular-nums">
                {stat.value}
              </b>
              <span className="text-muted-foreground">{stat.label}</span>
              {stat.hint && <span className="text-xs text-muted-foreground">{stat.hint}</span>}
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
