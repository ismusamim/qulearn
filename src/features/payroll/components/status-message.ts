import type { StatusChangeDTO } from "../employees-service";

/** Tells the admin what stopping / returning an employee did to the open sheets. */
export function statusMessage(change: StatusChangeDTO): string {
  if (change.status === "STOPPED") {
    return `أُوقف «${change.name}»${change.removed ? " وخرج من كشف الشهر المفتوح" : ""}`;
  }
  const added = change.addedTo ? ` وأُضيف لكشف شهر ${change.addedTo.month}/${change.addedTo.year}` : "";
  return `عاد «${change.name}» عاملًا${added}`;
}
