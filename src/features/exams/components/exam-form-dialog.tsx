"use client";

import { type ReactNode, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { ShuffleIcon } from "lucide-react";
import { type FieldErrors, useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { todayISO } from "@/lib/dates";

import { createExamAction, suggestQuestionsAction, updateExamAction } from "../actions";
import { EXAM_TYPE_LABELS, type ExamType, examDraftError, questionCountOptions } from "../rules";
import { type CreateExamInput, createExamSchema } from "../schemas";
import type { MarkingSettings } from "../scoring";
import type { ExamDetailDTO, ExaminableStudentDTO, SavedExam } from "../service";
import type { CompetitionDTO } from "../settings-service";
import { ExamQuestionsTable } from "./exam-questions-table";

type Question = CreateExamInput["questions"][number];

// A new row has no position yet; the schema reports that when saving.
const blankQuestion = () => ({ mistakes: 0, prompts: 0, tajweedMistakes: 0 }) as Question;
const blankQuestions = (n: number) => Array.from({ length: n }, blankQuestion);

const emptyToNull = (value: unknown) => (value === "" || value == null ? null : String(value));
const juzValue = (value: unknown) => (value === "" || value == null ? null : Number(value));

function firstMessage(errors: FieldErrors): string | undefined {
  for (const value of Object.values(errors)) {
    if (!value || typeof value !== "object") continue;
    if ("message" in value && typeof value.message === "string" && value.message) return value.message;
    const nested = firstMessage(value as FieldErrors);
    if (nested) return nested;
  }
  return undefined;
}

/**
 * New exam (no `exam`) or edit by the examiner / admin. Type and student are
 * fixed once the exam exists. `children` is the button that opens the dialog.
 */
export function ExamFormDialog({
  exam,
  types,
  students,
  competitions,
  settings,
  children,
}: {
  exam?: ExamDetailDTO;
  /** The exam types the user may run. */
  types: ExamType[];
  students: ExaminableStudentDTO[];
  competitions: CompetitionDTO[];
  settings: MarkingSettings;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const firstType = exam?.type ?? types[0] ?? "PERIODIC";
  const form = useForm<CreateExamInput>({
    resolver: zodResolver(createExamSchema),
    defaultValues: exam
      ? {
          type: exam.type,
          studentId: exam.studentId,
          date: exam.date,
          juz: exam.juz,
          competitionId: exam.competitionId,
          levelId: exam.levelId,
          questions: exam.questions.map(({ surah, fromAyah, toAyah, mistakes, prompts, tajweedMistakes }) => ({
            surah,
            fromAyah,
            toAyah,
            mistakes,
            prompts,
            tajweedMistakes,
          })),
          note: exam.note,
        }
      : {
          type: firstType,
          studentId: "",
          date: todayISO(),
          juz: null,
          competitionId: null,
          levelId: null,
          questions: blankQuestions(questionCountOptions(firstType)[0]),
          note: "",
        },
  });
  const { fields, replace } = useFieldArray({ control: form.control, name: "questions" });
  const [type, competitionId] = useWatch({ control: form.control, name: ["type", "competitionId"] });

  const levels = competitions.find((c) => c.id === competitionId)?.levels ?? [];
  const findLevel = (id: string | null | undefined) => competitions.flatMap((c) => c.levels).find((l) => l.id === id) ?? null;
  const studentOptions = students.filter((s) => s.types.includes(type));

  /** Keeps what is already typed in the rows that remain. */
  const resize = (count: number) => {
    const current = form.getValues("questions");
    replace(Array.from({ length: count }, (_, i) => current[i] ?? blankQuestion()));
  };

  const onSaved = (saved: SavedExam) => {
    toast.success(`حُفظ الاختبار: ${saved.total} من ${saved.maxScore} — ${saved.grade}`);
    setOpen(false);
    if (!exam) form.reset();
  };
  const create = useAction(createExamAction, { onSuccess: onSaved });
  const update = useAction(updateExamAction, { onSuccess: onSaved });
  const suggest = useAction(suggestQuestionsAction, {
    onSuccess: (positions) => {
      positions.forEach((p, i) => {
        if (!p || i >= form.getValues("questions").length) return;
        form.setValue(`questions.${i}.surah`, p.surah, { shouldDirty: true });
        form.setValue(`questions.${i}.fromAyah`, p.fromAyah, { shouldDirty: true });
        form.setValue(`questions.${i}.toAyah`, p.toAyah, { shouldDirty: true });
      });
    },
  });
  const pending = create.pending || update.pending;

  /** The type-dependent rules, with the same messages the server would give. */
  const draftError = (values: CreateExamInput) =>
    examDraftError({ type: values.type, juz: values.juz, level: findLevel(values.levelId), questions: values.questions });

  const submit = form.handleSubmit(
    (values) => {
      const error = draftError(values);
      if (error) return void toast.error(error);
      if (!exam) return create.execute(values);
      const { date, juz, competitionId, levelId, questions, note } = values;
      update.execute({ id: exam.id, date, juz, competitionId, levelId, questions, note });
    },
    (errors) => {
      const values = form.getValues();
      const message = errors.studentId?.message ?? draftError(values) ?? firstMessage(errors);
      toast.error(message ?? "البيانات المدخلة غير صحيحة");
    },
  );

  const requestSuggestion = () => {
    const values = form.getValues();
    suggest.execute({
      type: values.type,
      studentId: values.studentId || null,
      count: values.questions.length,
      juz: values.juz,
      levelId: values.levelId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{exam ? "تعديل اختبار" : "اختبار جديد"}</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="exam-type">النوع</FieldLabel>
                {exam ? (
                  <Input id="exam-type" value={EXAM_TYPE_LABELS[exam.type]} disabled readOnly />
                ) : (
                  <NativeSelect
                    id="exam-type"
                    className="w-full"
                    {...form.register("type", {
                      onChange: (event) => {
                        const next = event.target.value as ExamType;
                        form.setValue("juz", null);
                        form.setValue("competitionId", null);
                        form.setValue("levelId", null);
                        // The chosen student may not be examinable for the new type.
                        const chosen = students.find((s) => s.id === form.getValues("studentId"));
                        if (chosen && !chosen.types.includes(next)) form.setValue("studentId", "");
                        resize(questionCountOptions(next)[0]);
                      },
                    })}
                  >
                    {types.map((t) => (
                      <NativeSelectOption key={t} value={t}>
                        {EXAM_TYPE_LABELS[t]}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                )}
              </Field>
              <Field data-invalid={!!form.formState.errors.date}>
                <FieldLabel htmlFor="exam-date">التاريخ</FieldLabel>
                <Input id="exam-date" type="date" dir="ltr" {...form.register("date")} aria-invalid={!!form.formState.errors.date} />
              </Field>
            </div>
            <Field data-invalid={!!form.formState.errors.studentId}>
              <FieldLabel htmlFor="exam-student">الطالب</FieldLabel>
              {exam ? (
                <Input id="exam-student" value={`${exam.studentName}${exam.halaqaLabel ? ` — ${exam.halaqaLabel}` : ""}`} disabled readOnly />
              ) : (
                <NativeSelect id="exam-student" className="w-full" aria-invalid={!!form.formState.errors.studentId} {...form.register("studentId")}>
                  <NativeSelectOption value="">— اختر الطالب —</NativeSelectOption>
                  {studentOptions.map((s) => (
                    <NativeSelectOption key={s.id} value={s.id}>
                      {s.name}
                      {s.halaqaLabel ? ` — ${s.halaqaLabel}` : ""}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              {type === "FOLLOW_UP" && (
                <Field>
                  <FieldLabel htmlFor="exam-count">عدد الأسئلة</FieldLabel>
                  <NativeSelect id="exam-count" className="w-full" value={fields.length} onChange={(e) => resize(Number(e.target.value))}>
                    {questionCountOptions("FOLLOW_UP").map((n) => (
                      <NativeSelectOption key={n} value={n}>
                        {n}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              )}
              {type === "PERIODIC" && (
                <Field>
                  <FieldLabel htmlFor="exam-revision">أسئلة المراجعة</FieldLabel>
                  {/* One question in the new portion, the rest in revision. */}
                  <NativeSelect id="exam-revision" className="w-full" value={fields.length - 1} onChange={(e) => resize(Number(e.target.value) + 1)}>
                    {questionCountOptions("PERIODIC").map((n) => (
                      <NativeSelectOption key={n} value={n - 1}>
                        {n - 1}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              )}
              {type === "MASTERY" && (
                <Field>
                  <FieldLabel htmlFor="exam-juz">الجزء</FieldLabel>
                  <NativeSelect id="exam-juz" className="w-full" {...form.register("juz", { setValueAs: juzValue })}>
                    <NativeSelectOption value="">— اختر الجزء —</NativeSelectOption>
                    {Array.from({ length: 30 }, (_, i) => (
                      <NativeSelectOption key={i + 1} value={i + 1}>
                        الجزء {i + 1}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              )}
              {type === "COMPETITION" && (
                <>
                  <Field>
                    <FieldLabel htmlFor="exam-competition">المسابقة</FieldLabel>
                    <NativeSelect
                      id="exam-competition"
                      className="w-full"
                      {...form.register("competitionId", { setValueAs: emptyToNull, onChange: () => form.setValue("levelId", null) })}
                    >
                      <NativeSelectOption value="">— اختر —</NativeSelectOption>
                      {competitions.map((c) => (
                        <NativeSelectOption key={c.id} value={c.id}>
                          {c.name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="exam-level">المستوى</FieldLabel>
                    <NativeSelect
                      id="exam-level"
                      className="w-full"
                      {...form.register("levelId", {
                        setValueAs: emptyToNull,
                        onChange: (event) => {
                          const level = findLevel(event.target.value);
                          if (level) resize(level.questionCount);
                        },
                      })}
                    >
                      <NativeSelectOption value="">— اختر —</NativeSelectOption>
                      {levels.map((l) => (
                        <NativeSelectOption key={l.id} value={l.id}>
                          {l.name} ({l.questionCount} أسئلة)
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={requestSuggestion} disabled={suggest.pending}>
                {suggest.pending ? <Spinner /> : <ShuffleIcon />}
                اقتراح أسئلة
              </Button>
              <span className="text-sm text-muted-foreground">يختار مواضع عشوائية من النطاق المناسب، ويمكنك تعديلها.</span>
            </div>

            <ExamQuestionsTable form={form} rows={fields} type={type} settings={settings} />

            <Field>
              <FieldLabel htmlFor="exam-note">
                {type === "FOLLOW_UP" ? "ملاحظات للمعلم (تصله في صفحة «الاختبارات»)" : "ملاحظات"}
              </FieldLabel>
              <Textarea id="exam-note" rows={3} {...form.register("note")} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner />}
              حفظ
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
