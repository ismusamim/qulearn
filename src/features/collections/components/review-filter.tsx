"use client";

import { useRouter } from "next/navigation";

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

import { REVIEW_FILTER_LABELS, REVIEW_FILTERS, type ReviewFilter } from "../logic";

/** Status filter of the accountant's list, kept in the URL. */
export function ReviewFilterSelect({ value }: { value: ReviewFilter }) {
  const router = useRouter();
  return (
    <NativeSelect
      aria-label="حالة القوائم"
      value={value}
      onChange={(e) => router.replace(`/collections/review?status=${e.target.value}`, { scroll: false })}
    >
      {REVIEW_FILTERS.map((f) => (
        <NativeSelectOption key={f} value={f}>
          {REVIEW_FILTER_LABELS[f]}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
