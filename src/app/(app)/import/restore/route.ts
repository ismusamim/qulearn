import { gunzipSync } from "node:zlib";

import { revalidatePath } from "next/cache";

import { analyzeBackup, applyBackup, type BackupAnalysis, type BackupApplyResult } from "@/features/import/backup-service";
import { applyBackupSchema } from "@/features/import/schemas";
import type { ActionResult } from "@/lib/action-result";
import { assertNotBlocked, getAuth } from "@/server/auth";
import { AppError, ValidationError } from "@/server/errors";

/**
 * Backup upload. A route handler rather than a server action because backups
 * (with photos) are far larger than the 1 MB server-action body limit. It
 * answers with the same ActionResult shape actions use.
 *
 * Form fields: `step` = "analyze" | "apply", `file` (JSON, gzip-compressed when
 * `encoding` = "gzip"), and for apply `strategy` + `confirmation`.
 */

/** Refuses absurd uploads (and decompression bombs) before parsing. */
const MAX_JSON_BYTES = 300 * 1024 * 1024;

type RestoreResponse = ActionResult<BackupAnalysis | BackupApplyResult>;

const json = (body: RestoreResponse, status = 200) => Response.json(body, { status });

async function readDocument(form: FormData): Promise<unknown> {
  const file = form.get("file");
  if (!(file instanceof Blob) || !file.size) throw new ValidationError("اختر ملف النسخة الاحتياطية");
  if (file.size > MAX_JSON_BYTES) throw new ValidationError("الملف أكبر من المسموح");
  let bytes = Buffer.from(await file.arrayBuffer());
  try {
    if (form.get("encoding") === "gzip") bytes = gunzipSync(bytes, { maxOutputLength: MAX_JSON_BYTES });
    return JSON.parse(bytes.toString("utf8").replace(/^﻿/, ""));
  } catch {
    throw new ValidationError("النص غير صالح — تأكد أنه ملف النسخة كاملًا");
  }
}

export async function POST(request: Request) {
  try {
    // Same-origin only: the session cookie must not be usable from another site.
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).host !== (request.headers.get("x-forwarded-host") ?? request.headers.get("host"))) {
      return json({ ok: false, error: "طلب غير مسموح" }, 403);
    }
    const auth = await getAuth();
    if (!auth) return json({ ok: false, error: "انتهت الجلسة، سجّل الدخول من جديد" }, 401);
    assertNotBlocked(auth);

    const form = await request.formData();
    const document = await readDocument(form);
    if (form.get("step") !== "apply") return json({ ok: true, data: await analyzeBackup(auth, document) });

    const options = applyBackupSchema.safeParse({ strategy: form.get("strategy"), confirmation: form.get("confirmation") ?? "" });
    if (!options.success) throw new ValidationError("اختر طريقة الاستيراد");
    const result = await applyBackup(auth, document, options.data);
    revalidatePath("/", "layout");
    return json({ ok: true, data: result });
  } catch (error) {
    if (error instanceof AppError) return json({ ok: false, error: error.message });
    console.error("[backup restore]", error);
    return json({ ok: false, error: "حدث خطأ غير متوقع، ولم يتغيّر شيء في البيانات" });
  }
}
