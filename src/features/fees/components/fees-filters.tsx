"use client";

import { useRef, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";

import type { FeeFiltersInput } from "../schemas";
import { feesHref } from "../url";

const BOXES = [
  { key: "qs", label: "اسم الطالب", placeholder: "اكتب جزءًا من الاسم" },
  { key: "qh", label: "الحلقة", placeholder: "بداية اسم الحلقة" },
  { key: "qp", label: "المكان", placeholder: "بداية اسم المكان" },
] as const;

/**
 * Three live search boxes and the month selector. They write to the URL (after a
 * short pause while typing); the server re-renders the results.
 */
export function FeesFilters({
  month,
  months,
  filters,
}: {
  month: string;
  months: ReadonlyArray<{ value: string; label: string }>;
  filters: FeeFiltersInput;
}) {
  const router = useRouter();
  const [values, setValues] = useState(filters);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigate = (nextFilters: FeeFiltersInput, nextMonth: string, delay: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      startTransition(() => router.replace(feesHref({ month: nextMonth, filters: nextFilters }), { scroll: false }));
    }, delay);
  };

  return (
    <div className="no-print grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {BOXES.map((box) => (
        <Field key={box.key}>
          <FieldLabel htmlFor={`fees-${box.key}`}>{box.label}</FieldLabel>
          <Input
            id={`fees-${box.key}`}
            type="search"
            autoComplete="off"
            placeholder={box.placeholder}
            value={values[box.key]}
            onChange={(e) => {
              const next = { ...values, [box.key]: e.target.value };
              setValues(next);
              navigate(next, month, 300);
            }}
          />
        </Field>
      ))}
      <Field>
        <FieldLabel htmlFor="fees-month">
          الشهر
          {pending && <Spinner />}
        </FieldLabel>
        <NativeSelect id="fees-month" className="w-full" value={month} onChange={(e) => navigate(values, e.target.value, 0)}>
          {months.map((m) => (
            <NativeSelectOption key={m.value} value={m.value}>
              {m.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
    </div>
  );
}
