"use client";

import { CopyIcon, RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";

import { PrintButton } from "@/components/shared/print-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { type ImportKind, KIND_ONE } from "../fields";
import type { ImportResult } from "../service";

/** Outcome of an import. Generated passwords are shown here once — they are stored only as hashes. */
export function ImportResultCard({ kind, result, onReset }: { kind: ImportKind; result: ImportResult; onReset: () => void }) {
  const copyAll = async () => {
    const text = result.credentials.map((c) => `${c.name}\t${c.password}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("تم النسخ");
    } catch {
      toast.error("تعذّر النسخ — حدّد الجدول وانسخه يدويًا");
    }
  };

  const summary = [
    `تم استيراد ${result.created} ${KIND_ONE[kind]}`,
    result.updated ? `وتحديث ${result.updated}` : "",
    result.skipped ? `وتجاهل ${result.skipped} مكرر` : "",
    result.halaqatCreated ? `وإنشاء ${result.halaqatCreated} حلقة` : "",
    result.pendingColumns ? `— ${result.pendingColumns} عمود في «بيانات معلّقة»` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <AlertTitle>{summary}</AlertTitle>
        <AlertDescription className="no-print">
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onReset}>
            <RotateCcwIcon />
            استيراد ملف آخر
          </Button>
        </AlertDescription>
      </Alert>

      {result.warnings.length > 0 && (
        <Alert variant="destructive" className="no-print">
          <AlertTitle>قيم لم تُستورد ({result.warnings.length})</AlertTitle>
          <AlertDescription>
            <ul className="list-disc ps-5">
              {result.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {result.credentials.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>كلمات المرور الجديدة</CardTitle>
            <CardDescription>تظهر هذه المرة فقط. انسخها أو اطبعها لتسليمها لأصحابها قبل مغادرة الصفحة.</CardDescription>
            <CardAction className="no-print flex gap-2">
              <Button type="button" variant="outline" onClick={() => void copyAll()}>
                <CopyIcon />
                نسخ الكل
              </Button>
              <PrintButton />
            </CardAction>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>الاسم</TableHead>
                  <TableHead>كلمة المرور</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.credentials.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>{c.name}</TableCell>
                    <TableCell dir="ltr" className="text-start font-mono">
                      {c.password}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
