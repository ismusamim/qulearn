import type { Metadata } from "next";

import { UsersIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CollectionStatusBadge } from "@/features/collections/components/collection-badges";
import { CollectionPicker } from "@/features/collections/components/collection-picker";
import { TeacherCollectionForm } from "@/features/collections/components/teacher-collection-form";
import { getTeacherCollection } from "@/features/collections/service";
import { currentYearMonth, monthKey, monthLabel, monthOptionsWith, parseMonthKey } from "@/features/fees/months";
import { monthName } from "@/lib/dates";
import { hasRole, requirePage } from "@/server/auth";

export const metadata: Metadata = { title: "التحصيل" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const text = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

export default async function CollectionsPage(props: { searchParams: SearchParams }) {
  const auth = await requirePage((a) => hasRole(a, "TEACHER"));
  const params = await props.searchParams;

  const today = currentYearMonth();
  const month = parseMonthKey(text(params.month), today);
  // Like the legacy page: the last six months up to next month.
  const months = monthOptionsWith(month, today, -6, 1).map((m) => ({ value: monthKey(m), label: monthLabel(m) }));
  const data = await getTeacherCollection(auth, text(params.halaqa) || null, month);
  const { halaqaId } = data;

  return (
    <>
      <PageHeader title="التحصيل" description="سجّل ما حصّلته من طلاب حلقتك في الشهر، ثم أرسل القائمة للمحاسب ليراجعها." />
      {halaqaId === null ? (
        <EmptyState icon={UsersIcon} title="لم تُسنَد إليك حلقة بعد." />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              <CollectionPicker halaqat={data.halaqat} halaqaId={halaqaId} month={monthKey(month)} months={months} />
            </CardTitle>
            {data.collection && (
              <CardAction>
                <CollectionStatusBadge status={data.collection.status} />
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            <TeacherCollectionForm
              // What was typed belongs to one halaqa + month, and is reloaded when the list changes state.
              key={`${halaqaId}|${monthKey(month)}|${data.collection?.status ?? "NEW"}`}
              data={{ ...data, halaqaId }}
              year={month.year}
              month={month.month}
              monthName={monthName(month.month)}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}
