import { formatTime12 } from "@/lib/dates";

/** The fields needed to describe when a halaqa meets. */
export interface HalaqaSchedule {
  scheduleMode: "CLOCK" | "PRAYER" | null;
  startTime: string | null;
  endTime: string | null;
  startPrayer: string | null;
  endPrayer: string | null;
}

/** The fields needed to name a halaqa. */
export interface HalaqaNaming extends HalaqaSchedule {
  id: string;
  name: string;
  teacherId: string | null;
  teacherName: string | null;
  placeId: string | null;
  placeName: string | null;
}

/** «من 4:00 م إلى 6:00 م» or «من بعد صلاة العصر إلى صلاة المغرب»; empty when unset. */
export function scheduleText(h: HalaqaSchedule): string {
  if (h.scheduleMode === "CLOCK") {
    return h.startTime && h.endTime ? `من ${formatTime12(h.startTime)} إلى ${formatTime12(h.endTime)}` : "";
  }
  if (h.scheduleMode === "PRAYER" && h.startPrayer) {
    const end = h.endPrayer
      ? ` إلى صلاة ${h.endPrayer}`
      : h.endTime
        ? ` إلى الساعة ${formatTime12(h.endTime)}`
        : "";
    return `من بعد صلاة ${h.startPrayer}${end}`;
  }
  return "";
}

/**
 * A halaqa is named after its teacher: «حلقة الشيخ أحمد». When the teacher has
 * several, the place is appended, then the time (or an index) if the place
 * repeats too. `all` must contain every halaqa of that teacher.
 */
export function halaqaLabel(h: HalaqaNaming, all: readonly HalaqaNaming[]): string {
  if (!h.teacherId || !h.teacherName) return h.name || "حلقة بلا معلم";
  const siblings = all.filter((x) => x.teacherId === h.teacherId);
  if (siblings.length < 2) return `حلقة ${h.teacherName}`;
  const samePlace = siblings.filter((x) => x.placeId === h.placeId).length > 1;
  const index = siblings.findIndex((x) => x.id === h.id) + 1;
  const tag = [h.placeName ?? "", samePlace ? scheduleText(h) || `#${index}` : ""].filter(Boolean).join(" · ");
  return `حلقة ${h.teacherName}${tag ? ` — ${tag}` : ""}`;
}
