"use client";

import { useFormContext } from "react-hook-form";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { CustomFieldDef } from "@/server/directory";

import { PROFILE_SECTIONS, type ProfileField, type SectionKey } from "../profile";

const GRID = "grid gap-4 sm:grid-cols-2";
const LTR_TYPES = new Set<ProfileField["type"]>(["tel", "email", "number", "date"]);

/**
 * The inputs of one section of the teacher's file. Must be rendered inside a
 * react-hook-form <FormProvider> whose values are keyed by the field names.
 */
export function SectionFields({ section, idPrefix }: { section: SectionKey; idPrefix: string }) {
  const { register, getValues, formState } = useFormContext<Record<string, unknown>>();

  return (
    <div className={GRID}>
      {PROFILE_SECTIONS[section].fields.map((field) => {
        const id = `${idPrefix}-${field.name}`;
        const message = formState.errors[field.name]?.message;
        const invalid = typeof message === "string";
        const wide = field.type === "textarea";
        return (
          <Field key={field.name} data-invalid={invalid} className={wide ? "sm:col-span-2" : undefined}>
            <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
            {field.type === "select" ? (
              <SelectInput id={id} field={field} current={String(getValues(field.name) ?? "")} {...register(field.name)} />
            ) : field.type === "textarea" ? (
              <Textarea id={id} rows={3} {...register(field.name)} />
            ) : (
              <Input
                id={id}
                // Numbers stay text inputs so Arabic digits can be typed; the schema converts them.
                type={field.type === "number" ? "text" : (field.type ?? "text")}
                inputMode={field.type === "number" ? "decimal" : undefined}
                dir={LTR_TYPES.has(field.type) ? "ltr" : undefined}
                className={LTR_TYPES.has(field.type) ? "text-end" : undefined}
                aria-invalid={invalid}
                {...register(field.name)}
              />
            )}
            {invalid && <FieldError>{message}</FieldError>}
          </Field>
        );
      })}
    </div>
  );
}

function SelectInput({
  field,
  current,
  ...props
}: { field: ProfileField; current: string } & React.ComponentProps<typeof NativeSelect>) {
  const options = field.options ?? [];
  // Imported files may hold a value outside the fixed list; keep it selectable instead of silently dropping it.
  const unknown = current !== "" && !options.some((o) => o.value === current);
  return (
    <NativeSelect className="w-full" {...props}>
      {field.name !== "status" && <NativeSelectOption value="">—</NativeSelectOption>}
      {unknown && <NativeSelectOption value={current}>{current}</NativeSelectOption>}
      {options.map((o) => (
        <NativeSelectOption key={o.value} value={o.value}>
          {o.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

const CUSTOM_INPUT_TYPE = { TEXT: "text", NUMBER: "text", DATE: "date" } as const;

/** Inputs for the admin-defined custom fields («بيانات إضافية»); values live in Member.extra. */
export function ExtraFields({
  fields,
  values,
  onChange,
  idPrefix,
}: {
  fields: CustomFieldDef[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  idPrefix: string;
}) {
  const set = (key: string, value: string) => onChange({ ...values, [key]: value });
  return (
    <div className={GRID}>
      {fields.map((field, index) => {
        const id = `${idPrefix}-extra-${index}`;
        const value = values[field.key] ?? "";
        return (
          <Field key={field.key} className={field.type === "TEXTAREA" ? "sm:col-span-2" : undefined}>
            <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
            {field.type === "TEXTAREA" ? (
              <Textarea id={id} rows={3} maxLength={2000} value={value} onChange={(e) => set(field.key, e.target.value)} />
            ) : (
              <Input
                id={id}
                type={CUSTOM_INPUT_TYPE[field.type]}
                inputMode={field.type === "NUMBER" ? "decimal" : undefined}
                dir={field.type === "TEXT" ? undefined : "ltr"}
                className={field.type === "TEXT" ? undefined : "text-end"}
                maxLength={2000}
                value={value}
                onChange={(e) => set(field.key, e.target.value)}
              />
            )}
          </Field>
        );
      })}
    </div>
  );
}
