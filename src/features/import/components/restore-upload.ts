import type { ActionResult } from "@/lib/action-result";

import type { BackupAnalysis, BackupApplyResult } from "../backup-service";
import type { BackupStrategy } from "../schemas";

/** Compresses the JSON before upload when the browser can: backups with photos are large. */
async function packFile(content: Blob): Promise<{ file: Blob; gzip: boolean }> {
  if (typeof CompressionStream === "undefined") return { file: content, gzip: false };
  try {
    const stream = content.stream().pipeThrough(new CompressionStream("gzip"));
    return { file: await new Response(stream).blob(), gzip: true };
  } catch {
    return { file: content, gzip: false };
  }
}

/**
 * Vercel rejects request bodies over 4.5 MB before they reach the app. A larger
 * backup must be imported from a local copy of the app connected to the same
 * database (see README → "Moving data from the old app").
 */
const HOSTED_UPLOAD_LIMIT = 4.4 * 1024 * 1024;
const isLocalHost = () => ["localhost", "127.0.0.1"].includes(window.location.hostname);

async function post<T>(content: Blob, fields: Record<string, string>): Promise<ActionResult<T>> {
  try {
    const { file, gzip } = await packFile(content);
    if (file.size > HOSTED_UPLOAD_LIMIT && !isLocalHost()) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      return {
        ok: false,
        error: `الملف بعد الضغط ${mb} م.ب، والحد على الخادم 4.4 م.ب. استورده من نسخة التطبيق على جهازك (localhost) المتصلة بقاعدة البيانات نفسها.`,
      };
    }
    const form = new FormData();
    form.set("file", file, "backup.json");
    if (gzip) form.set("encoding", "gzip");
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    const response = await fetch("/import/restore", { method: "POST", body: form });
    return (await response.json()) as ActionResult<T>;
  } catch {
    return { ok: false, error: "تعذّر رفع الملف. تحقق من الاتصال، وإن كان الملف كبيرًا جدًا فراجع مسؤول النظام." };
  }
}

export const analyzeBackupFile = (content: Blob) => post<BackupAnalysis>(content, { step: "analyze" });

export const applyBackupFile = (content: Blob, strategy: BackupStrategy, confirmation: string) =>
  post<BackupApplyResult>(content, { step: "apply", strategy, confirmation });
