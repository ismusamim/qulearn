import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HalaqaLine, StudentStats } from "@/features/recitations/components/student-stats";
import { recitationLine } from "@/features/recitations/progress";
import { getMyRecord } from "@/features/recitations/service";
import { hasRole, requirePage } from "@/server/auth";

export const metadata: Metadata = { title: "تقدمي" };

const RECENT = 5;

export default async function ProgressPage() {
  const auth = await requirePage((a) => hasRole(a, "STUDENT"));
  const record = await getMyRecord(auth);

  return (
    <>
      <PageHeader title={`أهلًا ${record.student.name}`} description={<HalaqaLine student={record.student} />} />
      <div className="flex flex-col gap-6">
        <StudentStats stats={record.stats} />
        {record.details.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>بياناتي</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-4 gap-y-2">
                {record.details.map((d) => (
                  <div key={d.label} className="contents">
                    <dt className="text-muted-foreground">{d.label}</dt>
                    <dd>{d.value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>آخر التسميعات</CardTitle>
            {record.recitations.length > RECENT && (
              <CardAction>
                <Button variant="link" size="sm" asChild>
                  <Link href="/history">السجل الكامل</Link>
                </Button>
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            {record.recitations.length === 0 ? (
              <EmptyState title="لا توجد تسجيلات بعد." />
            ) : (
              <ul className="flex flex-col divide-y">
                {record.recitations.slice(0, RECENT).map((r) => (
                  <li key={r.id} className="py-2.5 first:pt-0 last:pb-0">
                    {recitationLine(r)}
                    {r.grade && (
                      <>
                        {" — "}
                        <b>{r.grade}</b>
                      </>
                    )}
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      <span dir="ltr">{r.date}</span> {r.note}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
