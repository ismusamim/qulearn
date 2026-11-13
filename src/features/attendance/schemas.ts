import { z } from "zod";

import { isISODate } from "@/lib/dates";

const isoDate = z.string().refine(isISODate, "التاريخ غير صحيح");

/** One student's mark for one day. `status: null` clears the mark. */
export const setAttendanceSchema = z.object({
  studentId: z.uuid(),
  date: isoDate,
  status: z.enum(["PRESENT", "LATE", "EXCUSED", "ABSENT"]).nullable(),
});
export type SetAttendanceInput = z.input<typeof setAttendanceSchema>;

/** «الكل حاضر» for one halaqa on one day. */
export const markAllPresentSchema = z.object({
  halaqaId: z.uuid(),
  date: isoDate,
});
export type MarkAllPresentInput = z.input<typeof markAllPresentSchema>;
