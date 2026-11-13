import { z } from "zod";

import { PRAYERS } from "@/lib/constants";

import { scheduleIssue } from "./schedule";

/** "" means «بدون» in the teacher / supervisor selects. */
const optionalId = z.union([z.uuid(), z.literal("")]);
const optionalTime = z.union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "وقت غير صحيح"), z.literal("")]);
const optionalPrayer = z.union([z.enum(PRAYERS), z.literal("")]);

/**
 * Input for creating or editing a halaqa. The schedule inputs of both modes
 * are submitted; `scheduleIssue` decides which ones matter (see schedule.ts).
 */
export const halaqaSchema = z
  .object({
    placeId: z.uuid("اختر المكان"),
    teacherId: optionalId,
    supervisorId: optionalId,
    /** Fallback name, only editable while the halaqa has no teacher. Omitted = leave unchanged. */
    name: z.string().trim().max(120).optional(),
    mode: z.enum(["PRAYER", "CLOCK"]),
    from: optionalTime,
    to: optionalTime,
    fromPrayer: optionalPrayer,
    toKind: z.enum(["prayer", "clock"]),
    toPrayer: optionalPrayer,
    toTime: optionalTime,
  })
  .superRefine((value, ctx) => {
    const issue = scheduleIssue(value);
    if (issue) ctx.addIssue({ code: "custom", path: [issue.field], message: issue.message });
  });
export type HalaqaInput = z.input<typeof halaqaSchema>;

export const updateHalaqaSchema = halaqaSchema.safeExtend({ id: z.uuid() });

export const halaqaIdSchema = z.object({ id: z.uuid() });
