import { exportBackup } from "@/features/import/backup-service";
import { todayISO } from "@/lib/dates";
import { getAuth } from "@/server/auth";
import { AppError } from "@/server/errors";

/** Downloads the whole database as one JSON backup document (admins only — checked by the service). */
export async function GET() {
  const auth = await getAuth();
  if (!auth) return new Response("غير مسجّل الدخول", { status: 401 });
  try {
    const document = await exportBackup(auth);
    return new Response(JSON.stringify(document), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="qulearn-backup-${todayISO()}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof AppError) return new Response(error.message, { status: 403 });
    console.error("[backup export]", error);
    return new Response("تعذّر إنشاء النسخة الاحتياطية", { status: 500 });
  }
}
