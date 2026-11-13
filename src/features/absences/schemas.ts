import { z } from "zod";

import { isISODate } from "@/lib/dates";

import { OTHER_PLACE, OTHER_REASON } from "./constants";

const permission = z.enum(["", "WITH_PERMISSION", "WITHOUT_PERMISSION"]).default("");
const proof = z.enum(["", "BALANCE", "PROVEN"]).default("");

/** What the server accepts. `payMonth` and `proof` are honoured for admins only. */
export const createAbsenceSchema = z.object({
  employeeId: z.uuid("اختر اسم المعلم من القائمة"),
  date: z.string().refine(isISODate, "حدّد اليوم"),
  place: z.string().trim().min(1, "اختر مكان الحلقة").max(120),
  permission,
  reason: z.string().trim().min(1, "اختر السبب").max(200),
  note: z.string().trim().max(1000).default(""),
  /** 0 = the default payroll month. */
  payMonth: z.coerce.number<number | string>().int().min(0).max(12).default(0),
  proof,
});
export type CreateAbsenceInput = z.input<typeof createAbsenceSchema>;

/** The form as the user fills it: «أخرى» / «مكان آخر…» reveal a free-text field. */
export const absenceFormSchema = z
  .object({
    employeeId: z.string().min(1, "اختر اسم المعلم من القائمة"),
    date: z.string().refine(isISODate, "حدّد اليوم"),
    place: z.string().min(1, "اختر مكان الحلقة"),
    placeOther: z.string().trim().max(120),
    permission: z.enum(["", "WITH_PERMISSION", "WITHOUT_PERMISSION"]),
    reason: z.string().min(1, "اختر السبب"),
    reasonOther: z.string().trim().max(200),
    note: z.string().trim().max(1000),
    payMonth: z.number().int().min(0).max(12),
    proof: z.enum(["", "BALANCE", "PROVEN"]),
  })
  .superRefine((v, ctx) => {
    if (v.place === OTHER_PLACE && !v.placeOther) ctx.addIssue({ code: "custom", path: ["placeOther"], message: "اكتب المكان" });
    if (v.reason === OTHER_REASON && !v.reasonOther) ctx.addIssue({ code: "custom", path: ["reasonOther"], message: "اكتب السبب" });
  });
export type AbsenceFormValues = z.infer<typeof absenceFormSchema>;

export function toCreateAbsenceInput(v: AbsenceFormValues): CreateAbsenceInput {
  return {
    employeeId: v.employeeId,
    date: v.date,
    place: v.place === OTHER_PLACE ? v.placeOther : v.place,
    permission: v.permission,
    reason: v.reason === OTHER_REASON ? v.reasonOther : v.reason,
    note: v.note,
    payMonth: v.payMonth,
    proof: v.proof,
  };
}

export const absenceProofSchema = z.object({ id: z.uuid(), proof: z.enum(["", "BALANCE", "PROVEN"]) });

export const absenceIdSchema = z.object({ id: z.uuid() });
