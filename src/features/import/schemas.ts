import { z } from "zod";

import { FIELD_TYPES } from "./fields";

export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_COLUMNS = 80;

export const kindSchema = z.enum(["STUDENTS", "TEACHERS"]);

/** A Google Sheets share link; the host is verified again on the server (see parse/sheets.ts). */
export const sheetUrlSchema = z.object({ url: z.string().trim().min(1, "ضع رابط Google Sheets").max(600) });

/** Names and halaqa cells of a parsed file, to learn which already exist before importing. */
export const checkImportSchema = z.object({
  kind: kindSchema,
  names: z.array(z.string().max(200)).max(MAX_IMPORT_ROWS),
  halaqat: z.array(z.string().max(200)).max(MAX_IMPORT_ROWS),
});

export const importMembersSchema = z.object({
  kind: kindSchema,
  columns: z
    .array(
      z.object({
        header: z.string().trim().min(1).max(120),
        /** A field target id, or null to keep the column as «بيانات معلّقة». */
        target: z.string().max(80).nullable(),
      }),
    )
    .max(MAX_IMPORT_COLUMNS),
  rows: z
    .array(z.object({ name: z.string().trim().min(1).max(160), values: z.array(z.string().max(2000)).max(MAX_IMPORT_COLUMNS) }))
    .min(1, "لا توجد صفوف للاستيراد")
    .max(MAX_IMPORT_ROWS, `الحد الأقصى ${MAX_IMPORT_ROWS} صف في المرة الواحدة`),
  /** Rows whose name already exists: ignore them (default, as before) or update those members. */
  onDuplicate: z.enum(["skip", "update"]),
  createHalaqat: z.boolean(),
});
export type ImportMembersInput = z.input<typeof importMembersSchema>;

const pendingValues = z.array(z.object({ memberId: z.uuid(), value: z.string().trim().max(2000) })).max(20000);

export const pendingIdSchema = z.object({ id: z.uuid() });

export const savePendingSchema = z.object({
  id: z.uuid(),
  header: z.string().trim().min(1, "اكتب اسم الحقل").max(120),
  /** Kept with the draft so the admin's choice survives until approval. */
  type: z.enum(FIELD_TYPES),
  values: pendingValues,
});

/** «new» creates a custom field named after the column. */
export const DESTINATION_NEW = "new";

export const approvePendingSchema = savePendingSchema.extend({
  destination: z.string().min(1).max(80),
});

export const customFieldKeySchema = z.object({ kind: kindSchema, key: z.string().min(1).max(80) });

export const updateCustomFieldSchema = customFieldKeySchema.extend({
  label: z.string().trim().min(1, "اكتب اسم الحقل").max(120),
  type: z.enum(FIELD_TYPES),
});

/** What the admin must type before everything is replaced. */
export const REPLACE_PHRASE = "استبدال الكل";

export const applyBackupSchema = z.object({
  strategy: z.enum(["merge", "replace"]),
  confirmation: z.string().max(100).default(""),
});
export type BackupStrategy = z.infer<typeof applyBackupSchema>["strategy"];
