/** Money with thousands separators and at most two decimals: 1250.5 → "1,250.5" */
export function formatMoney(value: number | null | undefined): string {
  const rounded = Math.round((Number(value) || 0) * 100) / 100;
  return rounded.toLocaleString("en-US");
}

/** First letter of a name, for avatar fallbacks. */
export function initialOf(name: string | null | undefined): string {
  return (name ?? "").trim().charAt(0) || "؟";
}
