import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReviewFilterSelect } from "@/features/collections/components/review-filter";
import { ReviewList } from "@/features/collections/components/review-list";
import { parseReviewFilter } from "@/features/collections/logic";
import { listCollectionsForReview } from "@/features/collections/service";
import { can, requirePage } from "@/server/auth";

export const metadata: Metadata = { title: "تحصيل المعلمين" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CollectionsReviewPage(props: { searchParams: SearchParams }) {
  const auth = await requirePage((a) => can(a, "fees.collect"));
  const { status } = await props.searchParams;
  const filter = parseReviewFilter(typeof status === "string" ? status : null);
  const { collections, waiting } = await listCollectionsForReview(auth, filter);

  return (
    <>
      <PageHeader title="تحصيل المعلمين" description="راجع ما أرسله المعلمون مما حصّلوه من طلابهم." />
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            القوائم
            {waiting > 0 && (
              <Badge variant="destructive">
                <span dir="ltr">{waiting}</span> بانتظار المراجعة
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            «تأكيد» يسجّل المبلغ دفعةً في «الاشتراكات» باسمك، و«إرجاع» يعيد الاسم للمعلم بملاحظتك ليصححه.
          </CardDescription>
          <CardAction>
            <ReviewFilterSelect value={filter} />
          </CardAction>
        </CardHeader>
        <CardContent>
          <ReviewList collections={collections} />
        </CardContent>
      </Card>
    </>
  );
}
