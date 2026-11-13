"use client";

import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import { parseNationalId } from "@/lib/domain/national-id";
import { cn } from "@/lib/utils";

import { createStudentAction, updateStudentAction } from "../actions";
import type { StudentDTO, StudentFormOptions } from "../queries";
import { type StudentFormData, type StudentFormInput, studentFormSchema } from "../schemas";
import type { CreatedStudent } from "../service";
import { PhotoInput } from "./photo-input";
import { TextField } from "./student-form-fields";
import {
  AdultSection,
  ChildSection,
  ContactSection,
  DecisionSection,
  ExtraSection,
  GuardianSection,
  PlacementSection,
} from "./student-form-sections";

function defaults(student: StudentDTO | undefined, presetHalaqaId: string, today: string): StudentFormInput {
  const s = student;
  return {
    category: s?.category ?? "CHILD",
    name: s?.name ?? "",
    nationalId: s?.nationalId ?? "",
    birthDate: s?.birthDate ?? "",
    age: s?.category === "ADULT" && s.age != null ? String(s.age) : "",
    address: s?.address ?? "",
    phone: s?.phone ?? "",
    whatsapp: s?.whatsapp ?? "",
    study: s?.study ?? "",
    grade: s?.grade ?? "",
    guardianName: s?.guardianName ?? "",
    guardianJob: s?.guardianJob ?? "",
    guardianPhone: s?.guardianPhone ?? "",
    guardianWhatsapp: s?.guardianWhatsapp ?? "",
    guardianRelation: s?.guardianRelation ?? "",
    guardianRelationOther: s?.guardianRelationOther ?? "",
    maritalStatus: s?.maritalStatus ?? "",
    qualification: s?.qualification ?? "",
    qualificationStatus: s?.qualificationStatus ?? "",
    job: s?.job ?? "",
    availability: s?.availability ?? "",
    testReading: s?.testReading ?? "",
    testTajweed: s?.testTajweed ?? "",
    testHifz: s?.testHifz ?? "",
    halaqaId: s ? (s.halaqaId ?? "") : presetHalaqaId,
    // A new form is dated today; an old one without a date stays undated.
    joinDate: s ? (s.joinDate ?? "") : today,
    monthlyFee: s?.monthlyFee != null ? String(s.monthlyFee) : "",
    pledgeSigned: s?.pledgeSigned ?? false,
    photo: s?.photo ?? null,
    extra: s?.extra ?? {},
  };
}

const segment =
  "flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center text-sm font-medium transition-colors has-checked:border-primary has-checked:bg-primary/10 has-checked:text-primary has-focus-visible:ring-3 has-focus-visible:ring-ring/50";

/** استمارة التقديم — a new application (no `student`) or the admin editing a saved one. */
export function StudentForm({
  student,
  options,
  presetHalaqaId = "",
  today,
}: {
  student?: StudentDTO;
  options: StudentFormOptions;
  /** New forms start in the halaqa the list was filtered by. */
  presetHalaqaId?: string;
  /** Server's date, so the first render matches on both sides. */
  today: string;
}) {
  const router = useRouter();
  const [created, setCreated] = useState<CreatedStudent | null>(null);
  const form = useForm<StudentFormInput, unknown, StudentFormData>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: defaults(student, presetHalaqaId, today),
  });
  const category = useWatch({ control: form.control, name: "category" });
  const nationalId = useWatch({ control: form.control, name: "nationalId" });
  const child = category !== "ADULT";
  const nid = parseNationalId(nationalId, today);

  const create = useAction(createStudentAction, { onSuccess: setCreated });
  const update = useAction(updateStudentAction, {
    successMessage: "تم حفظ التعديلات",
    onSuccess: () => router.push(`/students/${student?.id}`),
  });
  const pending = create.pending || update.pending;

  const submit = form.handleSubmit((values) =>
    student ? update.execute({ ...values, id: student.id }) : create.execute(values),
  );

  // A complete, valid national ID fills in the birth date and the age.
  const nationalIdField = form.register("nationalId", {
    onChange: (e: { target: { value: string } }) => {
      const result = parseNationalId(e.target.value, today);
      if (result.status !== "valid") return;
      form.setValue("birthDate", result.birthDate, { shouldDirty: true });
      form.setValue("age", String(result.age), { shouldDirty: true });
    },
  });
  const nidError = form.formState.errors.nationalId;

  return (
    <>
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <Card>
          <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <Controller
              control={form.control}
              name="photo"
              render={({ field }) => <PhotoInput value={field.value} onChange={field.onChange} />}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              <div className="flex gap-2" role="radiogroup" aria-label="فئة الطالب">
                <label className={segment}>
                  <input type="radio" value="CHILD" className="sr-only" {...form.register("category")} />
                  صغير — له ولي أمر
                </label>
                <label className={segment}>
                  <input type="radio" value="ADULT" className="sr-only" {...form.register("category")} />
                  كبير
                </label>
              </div>
              <TextField form={form} name="name" label={child ? "اسم الطالب" : "الاسم"} autoComplete="off" />
              <Field data-invalid={!!nidError}>
                <FieldLabel htmlFor="student-nationalId">الرقم القومي</FieldLabel>
                <Input
                  id="student-nationalId"
                  dir="ltr"
                  inputMode="numeric"
                  maxLength={14}
                  autoComplete="off"
                  placeholder="14 رقمًا — يُستخرج منه تاريخ الميلاد والسن"
                  aria-invalid={!!nidError}
                  {...nationalIdField}
                />
                {nid.status === "valid" && (
                  <p className="text-sm text-success">
                    ✓ مواليد <span dir="ltr">{nid.birthDate}</span> — {nid.age} سنة
                  </p>
                )}
                {nid.status === "invalid" && !nidError && (
                  <p className={cn("text-sm", nid.partial ? "text-muted-foreground" : "text-destructive")}>{nid.error}</p>
                )}
                <FieldError errors={[nidError]} />
              </Field>
            </div>
          </CardContent>
        </Card>

        {child ? <ChildSection form={form} today={today} /> : <AdultSection form={form} />}
        <ContactSection form={form} />
        {child && <GuardianSection form={form} />}
        <PlacementSection form={form} />
        <DecisionSection form={form} halaqat={options.halaqat} places={options.places} child={child} />
        <ExtraSection form={form} fields={options.customFields} />

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {pending && <Spinner />}
            حفظ
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href={student ? `/students/${student.id}` : "/students"}>إلغاء</Link>
          </Button>
        </div>
      </form>

      <Dialog open={!!created} onOpenChange={(open) => !open && router.push("/students")}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>تم حفظ الاستمارة</DialogTitle>
            <DialogDescription>
              كلمة مرور «{created?.name}» للدخول — تظهر هذه المرة فقط، فدوّنها أو سلّمها للطالب الآن.
            </DialogDescription>
          </DialogHeader>
          <p dir="ltr" className="rounded-lg border border-gold bg-muted py-3 text-center font-mono text-2xl font-bold tracking-widest">
            {created?.password ?? "—"}
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                form.reset(defaults(undefined, presetHalaqaId, today));
                setCreated(null);
              }}
            >
              استمارة أخرى
            </Button>
            <Button asChild>
              <Link href={created ? `/students/${created.id}` : "/students"}>ملف الطالب</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
