"use client";

import { useRef, useState } from "react";

import { DownloadIcon, EyeIcon, FileSpreadsheetIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";

import { fetchSheetAction } from "../actions";
import type { ImportKind } from "../fields";
import { decodeText, parseCSV, type Table } from "../parse/csv";
import { looksLikeZip, parseXLSX } from "../parse/xlsx";

const TEMPLATES: Record<ImportKind, { file: string; csv: string }> = {
  STUDENTS: { file: "قالب-الطلاب.csv", csv: "الاسم,الحلقة,الجوال,كلمة المرور\nمحمد أحمد,حلقة الفرقان,,\n" },
  TEACHERS: { file: "قالب-المعلمين.csv", csv: "الاسم,الجوال,كلمة المرور\nأحمد علي,,\n" },
};

async function readSpreadsheet(file: File): Promise<Table> {
  if (/\.xls$/i.test(file.name)) throw new Error("xls");
  const buffer = await file.arrayBuffer();
  return /\.xlsx$/i.test(file.name) || looksLikeZip(buffer) ? parseXLSX(buffer) : parseCSV(decodeText(buffer));
}

/** The three ways to bring a table in: a file, pasted cells, or a Google Sheets link. */
export function ImportSource({
  kind,
  onTable,
  onError,
}: {
  kind: ImportKind;
  onTable: (table: Table) => void;
  onError: (message: string) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [pasted, setPasted] = useState("");
  const [url, setUrl] = useState("");
  const [reading, setReading] = useState(false);
  const sheet = useAction(fetchSheetAction, { onSuccess: onTable, onError });

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    try {
      onTable(await readSpreadsheet(file));
    } catch (error) {
      onError(
        error instanceof Error && error.message === "xls"
          ? "صيغة xls القديمة غير مدعومة. احفظ الملف بصيغة xlsx أو CSV ثم أعد المحاولة."
          : "تعذّرت قراءة الملف. جرّب حفظه بصيغة CSV أو الصق الخلايا مباشرة.",
      );
    } finally {
      setReading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const preview = () => {
    if (url.trim()) sheet.execute({ url });
    else if (pasted.trim()) onTable(parseCSV(pasted));
    else onError("اختر ملفًا أو الصق البيانات أو ضع رابط Google Sheets.");
  };

  const downloadTemplate = () => {
    const template = TEMPLATES[kind];
    // The BOM makes Excel read the Arabic headers as UTF-8.
    const href = URL.createObjectURL(new Blob(["﻿" + template.csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = href;
    a.download = template.file;
    a.click();
    URL.revokeObjectURL(href);
  };

  const busy = reading || sheet.pending;

  return (
    <FieldGroup>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx,.csv,.tsv,.txt"
          hidden
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <Button type="button" variant="outline" disabled={busy} onClick={() => fileInput.current?.click()}>
          {reading ? <Spinner /> : <FileSpreadsheetIcon />}
          اختيار ملف Excel أو CSV
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={downloadTemplate}>
          <DownloadIcon />
          تحميل قالب
        </Button>
      </div>
      <Field>
        <FieldLabel htmlFor="import-paste">أو الصق خلايا منسوخة من Excel أو Google Sheets</FieldLabel>
        <Textarea id="import-paste" rows={3} value={pasted} onChange={(e) => setPasted(e.target.value)} />
      </Field>
      <Field>
        <FieldLabel htmlFor="import-url">أو رابط Google Sheets (مشارك لكل من لديه الرابط)</FieldLabel>
        <Input
          id="import-url"
          type="url"
          dir="ltr"
          placeholder="https://docs.google.com/spreadsheets/d/..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") preview();
          }}
        />
      </Field>
      <div>
        <Button type="button" variant="secondary" disabled={busy} onClick={preview}>
          {sheet.pending ? <Spinner /> : <EyeIcon />}
          معاينة
        </Button>
      </div>
    </FieldGroup>
  );
}
