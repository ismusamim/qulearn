"use client";

import { type ReactNode, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";

import { createCompetitionAction, createLevelAction, updateCompetitionAction, updateLevelAction } from "../actions";
import { LEVEL_QUESTION_COUNTS } from "../rules";
import { type CompetitionInput, type LevelInput, competitionSchema, levelSchema } from "../schemas";
import type { LevelDTO } from "../settings-service";

/** New competition (no `competition`) or rename. */
export function CompetitionFormDialog({ competition, children }: { competition?: { id: string; name: string }; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const form = useForm<CompetitionInput>({ resolver: zodResolver(competitionSchema), defaultValues: { name: competition?.name ?? "" } });
  const onSuccess = () => {
    setOpen(false);
    if (!competition) form.reset();
  };
  const create = useAction(createCompetitionAction, { successMessage: "تمت إضافة المسابقة", onSuccess });
  const update = useAction(updateCompetitionAction, { successMessage: "تم حفظ التعديلات", onSuccess });
  const pending = create.pending || update.pending;
  const submit = form.handleSubmit((values) => (competition ? update.execute({ ...values, id: competition.id }) : create.execute(values)));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{competition ? `تعديل: ${competition.name}` : "مسابقة جديدة"}</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={!!form.formState.errors.name}>
              <FieldLabel htmlFor="competition-name">اسم المسابقة</FieldLabel>
              <Input id="competition-name" {...form.register("name")} aria-invalid={!!form.formState.errors.name} />
              <FieldError errors={[form.formState.errors.name]} />
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

/** New level of a competition (no `level`) or edit. Past exams keep the level name they were saved with. */
export function LevelFormDialog({ competitionId, level, children }: { competitionId: string; level?: LevelDTO; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const form = useForm<LevelInput>({
    resolver: zodResolver(levelSchema),
    defaultValues: {
      name: level?.name ?? "",
      fromJuz: level?.fromJuz ?? 30,
      toJuz: level?.toJuz ?? 30,
      questionCount: level?.questionCount ?? 2,
    },
  });
  const onSuccess = () => {
    setOpen(false);
    if (!level) form.reset();
  };
  const create = useAction(createLevelAction, { successMessage: "تمت إضافة المستوى", onSuccess });
  const update = useAction(updateLevelAction, { successMessage: "تم حفظ التعديلات", onSuccess });
  const pending = create.pending || update.pending;
  const { errors } = form.formState;
  const submit = form.handleSubmit((values) =>
    level ? update.execute({ ...values, id: level.id }) : create.execute({ ...values, competitionId }),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{level ? `تعديل: ${level.name}` : "مستوى جديد"}</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="level-name">اسم المستوى (مثال: المستوى الأول — جزء عم)</FieldLabel>
              <Input id="level-name" {...form.register("name")} aria-invalid={!!errors.name} />
              <FieldError errors={[errors.name]} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.fromJuz}>
                <FieldLabel htmlFor="level-from">من الجزء</FieldLabel>
                <Input
                  id="level-from"
                  type="number"
                  dir="ltr"
                  min={1}
                  max={30}
                  {...form.register("fromJuz", { valueAsNumber: true })}
                  aria-invalid={!!errors.fromJuz}
                />
                <FieldError errors={[errors.fromJuz]} />
              </Field>
              <Field data-invalid={!!errors.toJuz}>
                <FieldLabel htmlFor="level-to">إلى الجزء</FieldLabel>
                <Input
                  id="level-to"
                  type="number"
                  dir="ltr"
                  min={1}
                  max={30}
                  {...form.register("toJuz", { valueAsNumber: true })}
                  aria-invalid={!!errors.toJuz}
                />
                <FieldError errors={[errors.toJuz]} />
              </Field>
            </div>
            <Field data-invalid={!!errors.questionCount}>
              <FieldLabel htmlFor="level-count">عدد الأسئلة (من 2 إلى 5)</FieldLabel>
              <NativeSelect id="level-count" className="w-full" {...form.register("questionCount", { valueAsNumber: true })}>
                {LEVEL_QUESTION_COUNTS.map((n) => (
                  <NativeSelectOption key={n} value={n}>
                    {n}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldError errors={[errors.questionCount]} />
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
