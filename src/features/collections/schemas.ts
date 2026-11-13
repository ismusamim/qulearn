import { z } from "zod";

/** A teacher's list for one halaqa and month. `send` = «إرسال للمحاسب», otherwise «حفظ مسودة». */
export const saveCollectionSchema = z.object({
  halaqaId: z.uuid(),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1, "شهر غير صحيح").max(12, "شهر غير صحيح"),
  lines: z
    .array(
      z.object({
        studentId: z.uuid(),
        amount: z.number({ error: "مبلغ غير صحيح" }).min(0, "مبلغ غير صحيح").max(10_000_000, "مبلغ غير صحيح"),
        note: z.string().max(1000),
      }),
    )
    .max(1000),
  send: z.boolean(),
});
export type SaveCollectionInput = z.infer<typeof saveCollectionSchema>;

/** The accountant's decisions on a sent list: confirm a line, or return it with a note. */
export const reviewCollectionSchema = z.object({
  collectionId: z.uuid(),
  decisions: z
    .array(
      z
        .object({ studentId: z.uuid(), ok: z.boolean(), note: z.string().trim().max(300) })
        .refine((d) => d.ok || d.note !== "", { message: "اكتب ملاحظة لكل اسم تعيده للمعلم" }),
    )
    .max(1000),
  /** Overall note for the teacher. */
  note: z.string().trim().max(500),
});
export type ReviewCollectionInput = z.infer<typeof reviewCollectionSchema>;
