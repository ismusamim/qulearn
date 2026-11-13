"use client";

import { useRef, useState } from "react";

import { DatabaseBackupIcon, DownloadIcon, FileJsonIcon, SearchCheckIcon } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

import type { BackupAnalysis, BackupApplyResult } from "../backup-service";
import { type BackupStrategy, REPLACE_PHRASE } from "../schemas";
import { CountsTable, ReportDetails } from "./backup-report";
import { analyzeBackupFile, applyBackupFile } from "./restore-upload";

const SOURCE_LABELS = { qulearn: "نسخة احتياطية من هذا التطبيق", legacy: "نسخة من التطبيق القديم — ستُحوَّل إلى الصيغة الجديدة" } as const;

function ExportCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>تصدير نسخة احتياطية</CardTitle>
        <CardDescription>
          ملف JSON واحد فيه كل البيانات: الحسابات والاستمارات والصور، الحلقات، الحضور والتسميع، الاشتراكات والتحصيل، المرتبات،
          الاختبارات والإعدادات. كلمات المرور تُحفظ مشفّرة، لكن الملف يحتوي بيانات شخصية ومرتبات فاحفظه بأمان.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <a href="/import/export" download>
            <DownloadIcon />
            تنزيل النسخة الاحتياطية
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

function RestoreCard() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState<Blob | null>(null);
  const [fileName, setFileName] = useState("");
  const [pasted, setPasted] = useState("");
  const [analysis, setAnalysis] = useState<BackupAnalysis | null>(null);
  const [strategy, setStrategy] = useState<BackupStrategy>("merge");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState<"analyze" | "apply" | null>(null);
  const [result, setResult] = useState<BackupApplyResult | null>(null);

  const clear = () => {
    setContent(null);
    setFileName("");
    setPasted("");
    setAnalysis(null);
    setConfirmation("");
    if (fileInput.current) fileInput.current.value = "";
  };

  const analyze = async () => {
    const source = content ?? (pasted.trim() ? new Blob([pasted], { type: "application/json" }) : null);
    if (!source) {
      toast.error("اختر ملف النسخة أو الصق نصها");
      return;
    }
    setBusy("analyze");
    setResult(null);
    const response = await analyzeBackupFile(source);
    setBusy(null);
    if (!response.ok) {
      toast.error(response.error);
      return;
    }
    setContent(source);
    setAnalysis(response.data);
  };

  const apply = async () => {
    if (!content) return;
    setBusy("apply");
    const response = await applyBackupFile(content, strategy, confirmation);
    setBusy(null);
    if (!response.ok) {
      toast.error(response.error);
      return;
    }
    toast.success(strategy === "replace" ? "تم استبدال البيانات" : "تم الدمج");
    clear();
    setResult(response.data);
  };

  const confirmed = strategy === "merge" || confirmation.trim() === REPLACE_PHRASE;

  return (
    <Card>
      <CardHeader>
        <CardTitle>استعادة أو استيراد نسخة</CardTitle>
        <CardDescription>
          يقبل نسخة هذا التطبيق، ونسخة التطبيق القديم (ملف «halaqat-backup» أو النص المنسوخ منه). يُفحص الملف أولًا ويُعرض ما فيه قبل
          أي تغيير.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setContent(file);
              setFileName(file.name);
              setAnalysis(null);
              setResult(null);
            }}
          />
          <Button type="button" variant="outline" disabled={!!busy} onClick={() => fileInput.current?.click()}>
            <FileJsonIcon />
            اختيار ملف النسخة
          </Button>
          {fileName && (
            <span dir="ltr" className="text-sm text-muted-foreground">
              {fileName}
            </span>
          )}
        </div>
        {!fileName && (
          <Field>
            <FieldLabel htmlFor="backup-paste">أو الصق نص النسخة الاحتياطية هنا</FieldLabel>
            <Textarea
              id="backup-paste"
              dir="ltr"
              rows={3}
              className="max-h-40 font-mono text-xs"
              value={pasted}
              onChange={(e) => {
                setPasted(e.target.value);
                setContent(null);
                setAnalysis(null);
              }}
            />
          </Field>
        )}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" disabled={!!busy} onClick={() => void analyze()}>
            {busy === "analyze" ? <Spinner /> : <SearchCheckIcon />}
            فحص الملف
          </Button>
          {(fileName || analysis) && (
            <Button type="button" variant="ghost" disabled={!!busy} onClick={clear}>
              إلغاء
            </Button>
          )}
        </div>

        {analysis && (
          <div className="flex flex-col gap-4 border-t pt-5">
            <p className="font-medium">
              {SOURCE_LABELS[analysis.source]}
              {analysis.exportedAt && (
                <span className="ms-2 text-sm font-normal text-muted-foreground" dir="ltr">
                  {analysis.exportedAt.slice(0, 16).replace("T", " ")}
                </span>
              )}
            </p>
            <CountsTable columns={[{ label: "في الملف", counts: analysis.report.counts }]} />
            <ReportDetails report={analysis.report} />

            <RadioGroup value={strategy} onValueChange={(value) => setStrategy(value as BackupStrategy)}>
              <div className="flex items-start gap-2">
                <RadioGroupItem id="strategy-merge" value="merge" className="mt-1" />
                <Label htmlFor="strategy-merge" className="flex flex-col items-start gap-1">
                  دمج
                  <span className="text-sm font-normal text-muted-foreground">
                    يُضاف ما ليس موجودًا (المطابقة بالمعرّف أو بالاسم)، ولا يُحذف أو يُعدَّل شيء من البيانات الحالية.
                  </span>
                </Label>
              </div>
              <div className="flex items-start gap-2">
                <RadioGroupItem id="strategy-replace" value="replace" className="mt-1" />
                <Label htmlFor="strategy-replace" className="flex flex-col items-start gap-1">
                  استبدال الكل
                  <span className="text-sm font-normal text-muted-foreground">
                    تُحذف كل البيانات الحالية وتحل النسخة محلها.
                  </span>
                </Label>
              </div>
            </RadioGroup>

            {strategy === "replace" && (
              <Alert variant="destructive">
                <AlertTitle>سيتم استبدال كل البيانات الحالية</AlertTitle>
                <AlertDescription className="flex flex-col gap-3">
                  <span>
                    لا يمكن التراجع؛ نزّل نسخة احتياطية أولًا. حسابك الحالي يبقى باسمه وكلمة مروره وتبقى جلستك، أما بقية المستخدمين
                    فتنتهي جلساتهم ويدخلون بكلمات المرور التي في النسخة.
                  </span>
                  <Field>
                    <FieldLabel htmlFor="replace-phrase">للتأكيد اكتب «{REPLACE_PHRASE}»</FieldLabel>
                    <Input id="replace-phrase" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="off" />
                  </Field>
                </AlertDescription>
              </Alert>
            )}

            <Field>
              <div>
                <Button
                  type="button"
                  variant={strategy === "replace" ? "destructive" : "default"}
                  disabled={!!busy || !confirmed}
                  onClick={() => void apply()}
                >
                  {busy === "apply" ? <Spinner /> : <DatabaseBackupIcon />}
                  {strategy === "replace" ? "استبدال الكل" : "دمج في البيانات الحالية"}
                </Button>
              </div>
              {analysis.source === "legacy" && (
                <FieldDescription>كلمات المرور القديمة تُشفَّر عند الاستيراد، وقد يستغرق ذلك دقائق مع الأعداد الكبيرة.</FieldDescription>
              )}
            </Field>
          </div>
        )}

        {result && (
          <div className="flex flex-col gap-4 border-t pt-5">
            <p className="font-medium">{result.strategy === "replace" ? "تم استبدال البيانات. ما كُتب:" : "تم الدمج. النتيجة:"}</p>
            <CountsTable
              columns={
                result.strategy === "merge"
                  ? [
                      { label: "أُضيف", counts: result.inserted },
                      { label: "موجود من قبل", counts: result.alreadyThere },
                    ]
                  : [{ label: "كُتب", counts: result.inserted }]
              }
            />
            <ReportDetails report={result.report} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function BackupPanel() {
  return (
    <div className="flex flex-col gap-6">
      <ExportCard />
      <RestoreCard />
    </div>
  );
}
