import type { FeeFiltersInput } from "./schemas";

export type FeesTab = "collect" | "config";

/** Link to the fees page keeping tab, month and search in the URL (so they survive a reload). */
export function feesHref(params: { tab?: FeesTab; month?: string; filters?: Partial<FeeFiltersInput> }): string {
  const query = new URLSearchParams();
  if (params.tab && params.tab !== "collect") query.set("tab", params.tab);
  if (params.month) query.set("month", params.month);
  for (const key of ["qs", "qh", "qp"] as const) {
    const value = params.filters?.[key]?.trim();
    if (value) query.set(key, value);
  }
  const text = query.toString();
  return text ? `/fees?${text}` : "/fees";
}
