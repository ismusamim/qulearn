"use client";

import { useTransition } from "react";

import { useRouter } from "next/navigation";

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";

/** Halaqa and month selectors of the teacher's page; the choice lives in the URL. */
export function CollectionPicker({
  halaqat,
  halaqaId,
  month,
  months,
}: {
  halaqat: ReadonlyArray<{ id: string; label: string }>;
  halaqaId: string;
  month: string;
  months: ReadonlyArray<{ value: string; label: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const go = (nextHalaqa: string, nextMonth: string) =>
    startTransition(() => router.replace(`/collections?halaqa=${nextHalaqa}&month=${nextMonth}`, { scroll: false }));

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      {halaqat.length > 1 ? (
        <NativeSelect aria-label="الحلقة" value={halaqaId} onChange={(e) => go(e.target.value, month)}>
          {halaqat.map((h) => (
            <NativeSelectOption key={h.id} value={h.id}>
              {h.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      ) : (
        <b>{halaqat[0]?.label}</b>
      )}
      <NativeSelect aria-label="الشهر" value={month} onChange={(e) => go(halaqaId, e.target.value)}>
        {months.map((m) => (
          <NativeSelectOption key={m.value} value={m.value}>
            {m.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {pending && <Spinner />}
    </div>
  );
}
