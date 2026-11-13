import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowRightIcon } from "lucide-react";
import { z } from "zod";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CollectionStatusBadge } from "@/features/collections/components/collection-badges";
import { ReviewForm } from "@/features/collections/components/review-form";
import { type CollectionDetailDTO, getCollectionForReview } from "@/features/collections/service";
import { CURRENCY_LABEL } from "@/lib/constants";
import { monthName } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { can, requirePage } from "@/server/auth";
import { NotFoundError } from "@/server/errors";

export const metadata: Metadata = { title: "مراجعة تحصيل معلم" };

export default async function CollectionReviewPage(props: { params: Promise<{ id: string }> }) {
  const auth = await requirePage((a) => can(a, "fees.collect"));
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();

  let collection: CollectionDetailDTO;
  try {
    collection = await getCollectionForReview(auth, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return (
    <>
      <PageHeader title={`تحصيل ${collection.teacherName} — ${monthName(collection.month)} ${collection.year}`}>
        <Button asChild variant="outline">
          <Link href="/collections/review">
            <ArrowRightIcon />
            كل القوائم
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardHeader>
          <CardTitle>{collection.halaqaLabel ?? "حلقة محذوفة"}</CardTitle>
          <CardDescription>
            <span dir="ltr">{collection.lineCount}</span> طالبًا · الإجمالي <span dir="ltr">{formatMoney(collection.total)}</span>{" "}
            {CURRENCY_LABEL}
            {collection.reviewedByName && ` · راجعها ${collection.reviewedByName}`}
          </CardDescription>
          <CardAction>
            <CollectionStatusBadge status={collection.status} />
          </CardAction>
        </CardHeader>
        <CardContent>
          {/* Remount when the list changes state so stale decisions are never re-submitted. */}
          <ReviewForm key={`${collection.id}|${collection.status}`} collection={collection} />
        </CardContent>
      </Card>
    </>
  );
}
