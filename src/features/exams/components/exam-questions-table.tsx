"use client";

import { type UseFormReturn, useWatch } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SURAHS, surahByNumber } from "@/lib/quran";

import { type ExamType, questionLabel } from "../rules";
import type { CreateExamInput } from "../schemas";
import { type MarkingSettings, markExam } from "../scoring";

export type ExamForm = UseFormReturn<CreateExamInput>;

/** Empty inputs: no position yet, zero counts. */
const optionalNumber = (value: unknown) => (value === "" || value == null ? undefined : Number(value));
const countNumber = (value: unknown) => (value === "" || value == null ? 0 : Number(value));

const COUNT_FIELDS = ["mistakes", "prompts", "tajweedMistakes"] as const;

/**
 * One row per question: where it is and the raw counts. The score column and the
 * total are a live preview only — the server marks the exam again when saving.
 */
export function ExamQuestionsTable({
  form,
  rows,
  type,
  settings,
}: {
  form: ExamForm;
  /** Field-array rows (stable keys). */
  rows: ReadonlyArray<{ id: string }>;
  type: ExamType;
  settings: MarkingSettings;
}) {
  const questions = useWatch({ control: form.control, name: "questions" }) ?? [];
  const result = markExam(questions, settings);
  const errors = form.formState.errors.questions;

  return (
    <div className="flex flex-col gap-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead />
            <TableHead>السورة</TableHead>
            <TableHead>من آية</TableHead>
            <TableHead>إلى آية</TableHead>
            <TableHead>أخطاء</TableHead>
            <TableHead>تنبيهات</TableHead>
            <TableHead>تجويد</TableHead>
            <TableHead>الدرجة</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => {
            const label = questionLabel(type, i, rows.length);
            const ayat = surahByNumber(questions[i]?.surah ?? 0)?.ayat;
            return (
              <TableRow key={row.id}>
                <TableCell className="font-semibold">{label}</TableCell>
                <TableCell>
                  <NativeSelect
                    aria-label={`سورة ${label}`}
                    aria-invalid={!!errors?.[i]?.surah}
                    {...form.register(`questions.${i}.surah`, { setValueAs: optionalNumber })}
                  >
                    <NativeSelectOption value="">—</NativeSelectOption>
                    {SURAHS.map((s) => (
                      <NativeSelectOption key={s.number} value={s.number}>
                        {s.number}. {s.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </TableCell>
                {(["fromAyah", "toAyah"] as const).map((name) => (
                  <TableCell key={name}>
                    <Input
                      type="number"
                      dir="ltr"
                      min={1}
                      max={ayat}
                      step={1}
                      className="w-18"
                      aria-label={`${name === "fromAyah" ? "من آية" : "إلى آية"} — ${label}`}
                      aria-invalid={!!errors?.[i]?.[name]}
                      {...form.register(`questions.${i}.${name}`, { setValueAs: optionalNumber })}
                    />
                  </TableCell>
                ))}
                {COUNT_FIELDS.map((name) => (
                  <TableCell key={name}>
                    <Input
                      type="number"
                      dir="ltr"
                      min={0}
                      step={1}
                      className="w-16"
                      aria-label={`${name === "mistakes" ? "أخطاء" : name === "prompts" ? "تنبيهات" : "تجويد"} — ${label}`}
                      aria-invalid={!!errors?.[i]?.[name]}
                      {...form.register(`questions.${i}.${name}`, { setValueAs: countNumber })}
                    />
                  </TableCell>
                ))}
                <TableCell dir="ltr" className="text-end font-medium">
                  {result.scores[i] ?? "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <p className="font-bold">
        المجموع: <span dir="ltr">{result.total}</span> من <span dir="ltr">{result.maxScore}</span> (
        <span dir="ltr">{Math.round(result.percent)}%</span>) — {result.grade}
      </p>
    </div>
  );
}
