import { BookOpenCheckIcon, MegaphoneIcon } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RECITATION_TYPE_LABELS } from "@/lib/constants";

import type { DashboardDTO } from "../service";

/** The latest recitations recorded across all halaqat. */
export function RecentRecitationsCard({ items, weekCount }: { items: DashboardDTO["recentRecitations"]; weekCount: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>آخر التسميع</CardTitle>
        <CardDescription>{weekCount} تسجيل خلال آخر سبعة أيام</CardDescription>
        <CardAction>
          <Button asChild variant="outline" size="sm">
            <Link href="/my-students">التسميع</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState icon={BookOpenCheckIcon} title="لا توجد تسجيلات بعد" />
        ) : (
          <ul className="flex flex-col divide-y">
            {items.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 first:pt-0 last:pb-0">
                <Link href={`/students/${r.studentId}`} className="font-medium hover:underline">
                  {r.studentName}
                </Link>
                <Badge variant="secondary">{RECITATION_TYPE_LABELS[r.type]}</Badge>
                <span>
                  سورة {r.surahName} <span dir="ltr">({r.fromAyah}–{r.toAyah})</span>
                </span>
                {r.grade && <span className="text-muted-foreground">{r.grade}</span>}
                <span className="ms-auto text-xs text-muted-foreground">
                  {r.recordedByName ? `${r.recordedByName} · ` : ""}
                  <span dir="ltr">{r.date}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Regular students who are not in any halaqa yet — they need placing. */
export function UnassignedStudentsCard({ unassigned }: { unassigned: DashboardDTO["unassigned"] }) {
  const more = unassigned.count - unassigned.students.length;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          طلاب بلا حلقة
          <Badge variant={unassigned.count ? "destructive" : "secondary"} dir="ltr">
            {unassigned.count}
          </Badge>
        </CardTitle>
        <CardDescription>طلاب منتظمون لم يُحدَّد لهم حلقة بعد.</CardDescription>
        <CardAction>
          <Button asChild variant="outline" size="sm">
            <Link href="/students">الطلاب</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {unassigned.count === 0 ? (
          <p className="text-muted-foreground">كل الطلاب المنتظمين في حلقات.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {unassigned.students.map((s) => (
              <li key={s.id}>
                <Badge asChild variant="outline">
                  <Link href={`/students/${s.id}`}>{s.name}</Link>
                </Badge>
              </li>
            ))}
            {more > 0 && <li className="text-sm text-muted-foreground">و{more} آخرون…</li>}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Announcements addressed to the administration, newest first. */
export function NewsCard({ news }: { news: DashboardDTO["news"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>الإعلانات</CardTitle>
        <CardAction>
          <Button asChild variant="outline" size="sm">
            <Link href="/news">كل الإعلانات</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {news.length === 0 ? (
          <EmptyState icon={MegaphoneIcon} title="لا توجد إعلانات." />
        ) : (
          <ul className="flex flex-col gap-3">
            {news.map((n) => (
              <li key={n.id} className="border-s-2 border-gold ps-3">
                {n.authorLabel && <b className="block text-xs text-muted-foreground">ملاحظة من {n.authorLabel}</b>}
                <p className="whitespace-pre-line">{n.text}</p>
                <small dir="ltr" className="block text-end text-xs text-muted-foreground">
                  {n.date}
                </small>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
