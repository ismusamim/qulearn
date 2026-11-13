import { describe, expect, it } from "vitest";

import { scheduleText } from "@/lib/domain/halaqa";

import { halaqaSchema } from "./schemas";
import { DEFAULT_SCHEDULE_INPUT, type ScheduleInput, scheduleIssue, scheduleToInput, scheduleToModel } from "./schedule";

const input = (over: Partial<ScheduleInput>): ScheduleInput => ({ ...DEFAULT_SCHEDULE_INPUT, ...over });

describe("scheduleToModel", () => {
  it("stores clock mode as start/end time only", () => {
    expect(scheduleToModel(input({ mode: "CLOCK", from: "16:00", to: "18:30" }))).toEqual({
      scheduleMode: "CLOCK",
      startTime: "16:00",
      endTime: "18:30",
      startPrayer: null,
      endPrayer: null,
    });
  });

  it("stores prayer → prayer and drops a stale clock end", () => {
    expect(scheduleToModel(input({ fromPrayer: "العصر", toKind: "prayer", toPrayer: "العشاء", toTime: "20:00" }))).toEqual({
      scheduleMode: "PRAYER",
      startTime: null,
      endTime: null,
      startPrayer: "العصر",
      endPrayer: "العشاء",
    });
  });

  it("stores prayer → clock as start prayer + end time", () => {
    const model = scheduleToModel(input({ fromPrayer: "المغرب", toKind: "clock", toPrayer: "العشاء", toTime: "21:15" }));
    expect(model).toEqual({ scheduleMode: "PRAYER", startTime: null, endTime: "21:15", startPrayer: "المغرب", endPrayer: null });
    expect(scheduleText(model)).toBe("من بعد صلاة المغرب إلى الساعة 9:15 م");
  });
});

describe("scheduleToInput", () => {
  it("gives the defaults to a halaqa with no schedule", () => {
    expect(scheduleToInput(null)).toEqual(DEFAULT_SCHEDULE_INPUT);
    expect(scheduleToInput({ scheduleMode: null, startTime: null, endTime: null, startPrayer: null, endPrayer: null })).toEqual(
      DEFAULT_SCHEDULE_INPUT,
    );
  });

  it("round-trips every shape", () => {
    const shapes: ScheduleInput[] = [
      input({ mode: "CLOCK", from: "08:00", to: "10:00" }),
      input({ fromPrayer: "الفجر", toKind: "prayer", toPrayer: "الظهر" }),
      input({ fromPrayer: "العصر", toKind: "clock", toPrayer: "", toTime: "18:00" }),
    ];
    for (const shape of shapes) {
      const model = scheduleToModel(shape);
      expect(scheduleToModel(scheduleToInput(model))).toEqual(model);
    }
  });

  it("reads an end time in prayer mode as «إلى الساعة»", () => {
    const back = scheduleToInput({ scheduleMode: "PRAYER", startTime: null, endTime: "18:00", startPrayer: "العصر", endPrayer: null });
    expect(back.toKind).toBe("clock");
    expect(back.toTime).toBe("18:00");
  });
});

describe("scheduleIssue", () => {
  it("accepts valid schedules", () => {
    expect(scheduleIssue(DEFAULT_SCHEDULE_INPUT)).toBeNull();
    expect(scheduleIssue(input({ mode: "CLOCK", from: "09:00", to: "09:30" }))).toBeNull();
    expect(scheduleIssue(input({ toKind: "clock", toTime: "18:00" }))).toBeNull();
  });

  it("requires both clock times, in order", () => {
    expect(scheduleIssue(input({ mode: "CLOCK", from: "", to: "10:00" }))?.field).toBe("from");
    expect(scheduleIssue(input({ mode: "CLOCK", from: "10:00", to: "" }))?.field).toBe("to");
    expect(scheduleIssue(input({ mode: "CLOCK", from: "10:00", to: "10:00" }))?.message).toBe("ساعة النهاية يجب أن تكون بعد البداية");
    expect(scheduleIssue(input({ mode: "CLOCK", from: "18:00", to: "09:00" }))?.field).toBe("to");
  });

  it("requires the end prayer to come after the start prayer", () => {
    expect(scheduleIssue(input({ toPrayer: "" }))?.message).toBe("حدّد الصلاة التي تنتهي عندها الحلقة");
    expect(scheduleIssue(input({ fromPrayer: "المغرب", toPrayer: "العصر" }))?.message).toBe("صلاة النهاية يجب أن تكون بعد صلاة البداية");
    expect(scheduleIssue(input({ fromPrayer: "العصر", toPrayer: "العصر" }))?.field).toBe("toPrayer");
  });

  it("requires the end time when ending by clock", () => {
    expect(scheduleIssue(input({ toKind: "clock", toTime: "" }))?.field).toBe("toTime");
  });

  it("ignores the inputs of the mode that is not selected", () => {
    expect(scheduleIssue(input({ mode: "CLOCK", from: "09:00", to: "10:00", toPrayer: "" }))).toBeNull();
  });
});

describe("halaqaSchema", () => {
  const base = { placeId: "0b0e7d3e-5c0a-4b7e-9f43-0d3b1a1f2c11", teacherId: "", supervisorId: "", ...DEFAULT_SCHEDULE_INPUT };

  it("accepts a halaqa with no teacher or supervisor", () => {
    expect(halaqaSchema.safeParse(base).success).toBe(true);
  });

  it("requires a place", () => {
    const result = halaqaSchema.safeParse({ ...base, placeId: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("اختر المكان");
  });

  it("reports schedule problems on the offending field", () => {
    const result = halaqaSchema.safeParse({ ...base, mode: "CLOCK", from: "12:00", to: "11:00" });
    expect(result.error?.issues[0]?.path).toEqual(["to"]);
  });

  it("rejects malformed times", () => {
    expect(halaqaSchema.safeParse({ ...base, mode: "CLOCK", from: "25:00", to: "26:00" }).success).toBe(false);
  });
});
