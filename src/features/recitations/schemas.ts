import { z } from "zod";

import { GRADES } from "@/lib/constants";
import { isISODate } from "@/lib/dates";

import { validateAyahRange } from "./progress";

const ayah = z.number({ error: "اكتب رقم الآية" }).int("اكتب رقمًا صحيحًا").min(1, "تحقق من أرقام الآيات");

/** One recitation (تسميع). Shared by the dialog (client) and the action (server). */
export const recitationSchema = z
  .object({
    studentId: z.uuid(),
    date: z.string().refine(isISODate, "اختر التاريخ"),
    type: z.enum(["HIFZ", "REVIEW", "CONSOLIDATION"]),
    surah: z.number({ error: "اختر السورة" }).int().min(1, "اختر السورة").max(114, "اختر السورة"),
    fromAyah: ayah,
    toAyah: ayah,
    grade: z.enum(GRADES, "اختر التقدير"),
    note: z.string().trim().max(500, "الملاحظة طويلة جدًا").default(""),
  })
  .superRefine((value, ctx) => {
    // The range must fit the chosen surah (to ≥ from, to ≤ its number of ayat).
    const problem = validateAyahRange(value);
    if (problem) ctx.addIssue({ code: "custom", path: [problem.field], message: problem.message });
  });
export type RecitationInput = z.input<typeof recitationSchema>;

export const recitationIdSchema = z.object({ id: z.uuid() });
