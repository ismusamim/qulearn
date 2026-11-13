import { z } from "zod";

export const NEWS_AUDIENCES = ["ALL", "TEACHER", "SUPERVISOR", "STUDENT", "ACCOUNTANT", "ADMIN"] as const;
export type NewsAudience = (typeof NEWS_AUDIENCES)[number];

/** A note to the administration goes to the admins or to the supervisors, nobody else. */
export const NOTE_AUDIENCES = ["ADMIN", "SUPERVISOR"] as const;
export type NoteAudience = (typeof NOTE_AUDIENCES)[number];

export const NOTE_AUDIENCE_LABELS: Record<NoteAudience, string> = { ADMIN: "المدير", SUPERVISOR: "المشرفين" };

/** An announcement published by an admin. */
export const publishNewsSchema = z.object({
  text: z.string().trim().min(1, "اكتب نص الإعلان").max(2000, "النص طويل جدًا (الحد 2000 حرف)"),
  audience: z.enum(NEWS_AUDIENCES, "اختر الجمهور"),
});
export type PublishNewsInput = z.input<typeof publishNewsSchema>;

/** A note sent to the administration by a holder of `notes.send`. */
export const sendNoteSchema = z.object({
  audience: z.enum(NOTE_AUDIENCES, "جهة غير صحيحة"),
  text: z.string().trim().min(2, "اكتب الملاحظة").max(2000, "الملاحظة طويلة جدًا (الحد 2000 حرف)"),
});
export type SendNoteInput = z.input<typeof sendNoteSchema>;

export const newsIdSchema = z.object({ id: z.uuid() });
