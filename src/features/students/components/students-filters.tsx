"use client";

import { useEffect, useState } from "react";

import { SearchIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

import type { HalaqaChoice } from "../queries";
import type { StudentFilters } from "../schemas";

/** Search and filters of the students list; they live in the URL so they survive a reload. */
export function StudentsFilters({ filters, halaqat }: { filters: StudentFilters; halaqat: HalaqaChoice[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(filters.q);

  const apply = (patch: Partial<StudentFilters>) => {
    const next = { ...filters, ...patch, page: 1 };
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    if (next.category) params.set("category", next.category);
    if (next.halaqaId) params.set("halaqaId", next.halaqaId);
    if (next.status) params.set("status", next.status);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  // Typing narrows the list after a short pause instead of on every key.
  useEffect(() => {
    if (q.trim() === filters.q) return;
    const timer = setTimeout(() => apply({ q: q.trim() }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the typed text schedules a search
  }, [q]);

  return (
    <div className="no-print mb-4 flex flex-wrap items-center gap-2">
      <div className="relative min-w-56 flex-1">
        <SearchIcon className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="اسم الطالب أو الحلقة أو المكان"
          aria-label="بحث"
          autoComplete="off"
          className="ps-8"
        />
      </div>
      <NativeSelect
        aria-label="الفئة"
        value={filters.category}
        onChange={(e) => apply({ category: e.target.value as StudentFilters["category"] })}
      >
        <NativeSelectOption value="">الصغار والكبار</NativeSelectOption>
        <NativeSelectOption value="CHILD">الصغار</NativeSelectOption>
        <NativeSelectOption value="ADULT">الكبار</NativeSelectOption>
      </NativeSelect>
      <NativeSelect aria-label="الحلقة" className="max-w-64" value={filters.halaqaId} onChange={(e) => apply({ halaqaId: e.target.value })}>
        <NativeSelectOption value="">كل الحلقات</NativeSelectOption>
        <NativeSelectOption value="none">بلا حلقة</NativeSelectOption>
        {halaqat.map((h) => (
          <NativeSelectOption key={h.id} value={h.id}>
            {h.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect
        aria-label="الحالة"
        value={filters.status}
        onChange={(e) => apply({ status: e.target.value as StudentFilters["status"] })}
      >
        <NativeSelectOption value="">الكل</NativeSelectOption>
        <NativeSelectOption value="ACTIVE">المنتظمون</NativeSelectOption>
        <NativeSelectOption value="DROPPED">المنقطعون</NativeSelectOption>
      </NativeSelect>
    </div>
  );
}
