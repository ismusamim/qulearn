import { PRAYERS } from "@/lib/constants";
import type { HalaqaSchedule } from "@/lib/domain/halaqa";

/**
 * The halaqa form edits the schedule as one flat set of inputs (both modes are
 * kept while the user toggles between them); the database stores only the
 * fields the chosen mode needs. This module maps between the two and holds the
 * rules about which combinations are valid.
 */
export interface ScheduleInput {
  mode: "PRAYER" | "CLOCK";
  /** CLOCK: "HH:mm" start and end. */
  from: string;
  to: string;
  /** PRAYER: starts after this prayer… */
  fromPrayer: string;
  /** …and ends at a prayer or at a clock time. */
  toKind: "prayer" | "clock";
  toPrayer: string;
  toTime: string;
}

export type ScheduleField = "from" | "to" | "fromPrayer" | "toPrayer" | "toTime";

export interface ScheduleIssue {
  field: ScheduleField;
  message: string;
}

/** What a new halaqa starts with — the most common case: after Asr until Maghrib. */
export const DEFAULT_SCHEDULE_INPUT: ScheduleInput = {
  mode: "PRAYER",
  from: "",
  to: "",
  fromPrayer: "العصر",
  toKind: "prayer",
  toPrayer: "المغرب",
  toTime: "",
};

const prayerIndex = (prayer: string) => (PRAYERS as readonly string[]).indexOf(prayer);

/** The first problem with the schedule, or null when it can be saved. */
export function scheduleIssue(input: ScheduleInput): ScheduleIssue | null {
  if (input.mode === "CLOCK") {
    if (!input.from) return { field: "from", message: "حدّد ساعة البداية والنهاية" };
    if (!input.to) return { field: "to", message: "حدّد ساعة البداية والنهاية" };
    // "HH:mm" strings compare correctly as text.
    if (input.from >= input.to) return { field: "to", message: "ساعة النهاية يجب أن تكون بعد البداية" };
    return null;
  }
  if (prayerIndex(input.fromPrayer) < 0) return { field: "fromPrayer", message: "حدّد الصلاة التي تبدأ بعدها الحلقة" };
  if (input.toKind === "prayer") {
    if (!input.toPrayer) return { field: "toPrayer", message: "حدّد الصلاة التي تنتهي عندها الحلقة" };
    if (prayerIndex(input.toPrayer) <= prayerIndex(input.fromPrayer)) {
      return { field: "toPrayer", message: "صلاة النهاية يجب أن تكون بعد صلاة البداية" };
    }
    return null;
  }
  if (!input.toTime) return { field: "toTime", message: "حدّد ساعة انتهاء الحلقة" };
  return null;
}

/** Form inputs → stored columns. Fields the chosen mode does not use become null. */
export function scheduleToModel(input: ScheduleInput): HalaqaSchedule & { scheduleMode: "CLOCK" | "PRAYER" } {
  if (input.mode === "CLOCK") {
    return { scheduleMode: "CLOCK", startTime: input.from, endTime: input.to, startPrayer: null, endPrayer: null };
  }
  const byPrayer = input.toKind === "prayer";
  return {
    scheduleMode: "PRAYER",
    startTime: null,
    endTime: byPrayer ? null : input.toTime,
    startPrayer: input.fromPrayer,
    endPrayer: byPrayer ? input.toPrayer : null,
  };
}

/** Stored columns → form inputs. A halaqa with no schedule yet gets the defaults. */
export function scheduleToInput(model: HalaqaSchedule | null | undefined): ScheduleInput {
  if (!model?.scheduleMode) return { ...DEFAULT_SCHEDULE_INPUT };
  if (model.scheduleMode === "CLOCK") {
    return { ...DEFAULT_SCHEDULE_INPUT, mode: "CLOCK", from: model.startTime ?? "", to: model.endTime ?? "" };
  }
  // In prayer mode an end time (with no end prayer) means «إلى الساعة …».
  const byClock = !model.endPrayer && !!model.endTime;
  return {
    mode: "PRAYER",
    from: "",
    to: "",
    fromPrayer: model.startPrayer ?? DEFAULT_SCHEDULE_INPUT.fromPrayer,
    toKind: byClock ? "clock" : "prayer",
    toPrayer: model.endPrayer ?? "",
    toTime: byClock ? (model.endTime ?? "") : "",
  };
}
