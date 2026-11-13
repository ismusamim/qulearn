"use client";

import { useState } from "react";

import { UploadIcon } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAction } from "@/hooks/use-action";
import { fixName, normalizeArabic } from "@/lib/arabic";

import { checkImportAction, importMembersAction } from "../actions";
import { type FieldTarget, type ImportKind, TARGET_HALAQA } from "../fields";
import {
  analyzeTable, buildImportTable, type ColumnMatch, duplicateTargets, MAP_PENDING, type TableAnalysis,
} from "../matching";
import type { Table } from "../parse/csv";
import { MAX_IMPORT_ROWS } from "../schemas";
import type { ImportCheck, ImportResult } from "../service";
import { ImportResultCard } from "./import-result";
import { ImportSource } from "./import-source";
import { MappingPreview } from "./mapping-preview";

/** Server actions accept about 1 MB; a bigger table must be split by the admin. */
// Under Vercel's 4.5 MB request limit (and serverActions.bodySizeLimit in next.config.ts).
const MAX_PAYLOAD_BYTES = 4_000_000;

const NOTES: Record<ImportKind, string> = {
  STUDENTS: "الاسم، الحلقة، الجوال، كلمة المرور",
  TEACHERS: "الاسم، الجوال، كلمة المرور",
};

interface Parsed {
  analysis: TableAnalysis;
  columns: ColumnMatch[];
}

export function MemberImport({ targets }: { targets: Record<ImportKind, FieldTarget[]> }) {
  const [kind, setKind] = useState<ImportKind>("STUDENTS");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<ImportCheck>({ existingNames: [], unknownHalaqat: [] });
  const [onDuplicate, setOnDuplicate] = useState<"skip" | "update">("skip");
  const [createHalaqat, setCreateHalaqat] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);

  const check = useAction(checkImportAction, { onSuccess: setExisting });
  const run = useAction(importMembersAction, {
    onSuccess: (data: ImportResult) => {
      setResult(data);
      setParsed(null);
    },
  });

  const reset = () => {
    setParsed(null);
    setError(null);
    setResult(null);
    setExisting({ existingNames: [], unknownHalaqat: [] });
  };

  /** Asks the server which names exist and which halaqat are unknown, for the given mapping. */
  const runCheck = (analysis: TableAnalysis, columns: ColumnMatch[]) => {
    const halaqaColumn = columns.find((c) => c.target === TARGET_HALAQA)?.index;
    check.execute({
      kind,
      names: analysis.rows.map((r) => r[analysis.nameColumn] ?? ""),
      halaqat: halaqaColumn === undefined ? [] : [...new Set(analysis.rows.map((r) => r[halaqaColumn] ?? "").filter(Boolean))],
    });
  };

  const onTable = (table: Table) => {
    setResult(null);
    const outcome = analyzeTable(table, targets[kind]);
    if (!outcome.ok) {
      setParsed(null);
      setError(outcome.error);
      return;
    }
    if (outcome.analysis.rows.length > MAX_IMPORT_ROWS) {
      setParsed(null);
      setError(`في الملف ${outcome.analysis.rows.length} صفًا، والحد الأقصى ${MAX_IMPORT_ROWS} في المرة الواحدة. قسّمه ثم أعد المحاولة.`);
      return;
    }
    setError(null);
    setParsed({ analysis: outcome.analysis, columns: outcome.analysis.columns });
    runCheck(outcome.analysis, outcome.analysis.columns);
  };

  const changeMapping = (index: number, target: string) => {
    if (!parsed) return;
    const before = parsed.columns.find((c) => c.target === TARGET_HALAQA)?.index;
    const columns = parsed.columns.map((c) => (c.index === index ? { ...c, target } : c));
    setParsed({ ...parsed, columns });
    if (columns.find((c) => c.target === TARGET_HALAQA)?.index !== before) runCheck(parsed.analysis, columns);
  };

  const submit = () => {
    if (!parsed) return;
    if (duplicateTargets(parsed.columns).length) {
      toast.error("لا يُربط عمودان بالحقل نفسه.");
      return;
    }
    const payload = { kind, ...buildImportTable(parsed.analysis, parsed.columns), onDuplicate, createHalaqat };
    if (new Blob([JSON.stringify(payload)]).size > MAX_PAYLOAD_BYTES) {
      toast.error("الملف كبير على استيراد واحد. قسّمه إلى ملفين أو أكثر ثم استورد كلًّا منها.");
      return;
    }
    run.execute(payload);
  };

  if (result) return <ImportResultCard kind={kind} result={result} onReset={reset} />;

  // Counts for the summary line: names already registered, or repeated inside the file.
  const existingNames = new Set(existing.existingNames);
  let duplicates = 0;
  if (parsed) {
    const seen = new Set<string>();
    for (const row of parsed.analysis.rows) {
      const key = normalizeArabic(fixName(row[parsed.analysis.nameColumn]));
      if (seen.has(key) || existingNames.has(key)) duplicates++;
      seen.add(key);
    }
  }
  const total = parsed?.analysis.rows.length ?? 0;
  const ready = onDuplicate === "update" ? total : total - duplicates;
  const pendingCount = parsed?.columns.filter((c) => c.target === MAP_PENDING).length ?? 0;
  const hasHalaqaColumn = !!parsed?.columns.some((c) => c.target === TARGET_HALAQA);

  return (
    <Card>
      <CardHeader>
        <CardTitle>استيراد من Excel أو CSV أو Google Sheets</CardTitle>
        <CardDescription>
          الصف الأول عناوين الأعمدة: {NOTES[kind]}. الاسم وحده مطلوب، وتُنشأ كلمة المرور تلقائيًا إن تُركت فارغة، والأسماء المكررة
          تُتجاهل. أي عمود آخر ليس له نظير في النظام يُحفظ في «بيانات معلّقة» لاعتماده.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <ToggleGroup
          type="single"
          variant="outline"
          value={kind}
          onValueChange={(value) => {
            if (!value) return;
            setKind(value as ImportKind);
            reset();
          }}
        >
          <ToggleGroupItem value="STUDENTS">استيراد الطلاب</ToggleGroupItem>
          <ToggleGroupItem value="TEACHERS">استيراد المعلمين</ToggleGroupItem>
        </ToggleGroup>

        <ImportSource key={kind} kind={kind} onTable={onTable} onError={(message) => { setParsed(null); setError(message); }} />

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {parsed && (
          <>
            <p>
              <b>{ready}</b> جاهز للاستيراد
              {duplicates > 0 && (onDuplicate === "skip" ? ` — ${duplicates} مكرر سيُتجاهل` : ` — منها ${duplicates} مكرر`)}
              {check.pending && <Spinner className="ms-2 inline" />}
            </p>
            {pendingCount > 0 && (
              <Alert>
                <AlertDescription>
                  أعمدة ليس لها نظير ({pendingCount}): ستُحفظ قيمها في تبويب «بيانات معلّقة» لتراجعها وتعدّلها، ثم تعتمد إنشاء حقل لكل
                  منها.
                </AlertDescription>
              </Alert>
            )}

            <MappingPreview
              kind={kind}
              analysis={parsed.analysis}
              columns={parsed.columns}
              targets={targets[kind]}
              existingNames={existingNames}
              onChange={changeMapping}
            />

            {duplicates > 0 && (
              <RadioGroup value={onDuplicate} onValueChange={(value) => setOnDuplicate(value as "skip" | "update")}>
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="dup-skip" value="skip" />
                  <Label htmlFor="dup-skip">تجاهل الأسماء المكررة</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="dup-update" value="update" />
                  <Label htmlFor="dup-update">تحديث بيانات الموجودين من الملف (كلمات مرورهم لا تتغير)</Label>
                </div>
              </RadioGroup>
            )}

            {hasHalaqaColumn && existing.unknownHalaqat.length > 0 && (
              <div className="flex items-center gap-2">
                <Checkbox id="create-halaqat" checked={createHalaqat} onCheckedChange={(v) => setCreateHalaqat(v === true)} />
                <Label htmlFor="create-halaqat">إنشاء {existing.unknownHalaqat.length} حلقة غير موجودة تلقائيًا</Label>
              </div>
            )}

            <div>
              <Button type="button" disabled={run.pending || check.pending || ready === 0} onClick={submit}>
                {run.pending ? <Spinner /> : <UploadIcon />}
                استيراد
              </Button>
              {run.pending && <span className="ms-3 text-sm text-muted-foreground">جارٍ الاستيراد… قد يستغرق دقيقة مع الملفات الكبيرة.</span>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
