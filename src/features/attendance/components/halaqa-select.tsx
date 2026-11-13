"use client";

import { usePathname, useRouter } from "next/navigation";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "all";

/**
 * Halaqa picker that keeps its choice in the `halaqa` search param, so the
 * selection survives a reload. Other params (e.g. the date) are preserved.
 */
export function HalaqaSelect({
  halaqat,
  value,
  allLabel,
}: {
  halaqat: { id: string; label: string }[];
  value: string | null;
  /** When given, adds an option that clears the filter. */
  allLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const change = (next: string) => {
    const params = new URLSearchParams(window.location.search);
    if (next === ALL) params.delete("halaqa");
    else params.set("halaqa", next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <Select value={value ?? (allLabel ? ALL : "")} onValueChange={change}>
      <SelectTrigger className="min-w-52" aria-label="الحلقة">
        <SelectValue placeholder="اختر الحلقة" />
      </SelectTrigger>
      <SelectContent>
        {allLabel && <SelectItem value={ALL}>{allLabel}</SelectItem>}
        {halaqat.map((h) => (
          <SelectItem key={h.id} value={h.id}>
            {h.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
