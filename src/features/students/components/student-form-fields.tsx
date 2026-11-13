"use client";

import type { ComponentProps, ReactNode } from "react";

import type { UseFormReturn } from "react-hook-form";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

import type { StudentFormData, StudentFormInput } from "../schemas";

export type StudentForm = UseFormReturn<StudentFormInput, unknown, StudentFormData>;

/** Form fields edited as plain text (numbers are kept as text until validation). */
export type TextFieldName = {
  [K in keyof StudentFormInput]: StudentFormInput[K] extends string | number ? K : never;
}[keyof StudentFormInput];

/** One titled block of the paper form. */
export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

export function Row({ cols = 2, children }: { cols?: 2 | 3; children: ReactNode }) {
  return <div className={cols === 3 ? "grid gap-4 sm:grid-cols-3" : "grid gap-4 sm:grid-cols-2"}>{children}</div>;
}

export function TextField({
  form,
  name,
  label,
  hint,
  ...input
}: { form: StudentForm; name: TextFieldName; label: ReactNode; hint?: ReactNode } & Omit<ComponentProps<typeof Input>, "name" | "form">) {
  const error = form.formState.errors[name];
  const id = `student-${name}`;
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} aria-invalid={!!error} {...input} {...form.register(name)} />
      {hint}
      <FieldError errors={[error]} />
    </Field>
  );
}

export function SelectField({
  form,
  name,
  label,
  options,
  blank = "—",
}: {
  form: StudentForm;
  name: TextFieldName;
  label: ReactNode;
  options: readonly string[];
  blank?: string;
}) {
  const id = `student-${name}`;
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <NativeSelect id={id} className="w-full" {...form.register(name)}>
        <NativeSelectOption value="">{blank}</NativeSelectOption>
        {options.map((option) => (
          <NativeSelectOption key={option} value={option}>
            {option}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  );
}
