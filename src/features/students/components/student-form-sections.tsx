"use client";

import { useState } from "react";

import { Controller, useWatch } from "react-hook-form";

import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { GRADES, GUARDIAN_RELATIONS, MARITAL_STATUSES, QUALIFICATION_STATUSES, STUDY_TYPES } from "@/lib/constants";
import { ageFromBirthDate } from "@/lib/dates";
import type { CustomFieldDef, PlaceOption } from "@/server/directory";

import type { HalaqaChoice } from "../queries";
import { gradeOptions } from "../student-rules";
import { FormSection, Row, SelectField, type StudentForm, TextField } from "./student-form-fields";

export function ChildSection({ form, today }: { form: StudentForm; today: string }) {
  const birthDate = useWatch({ control: form.control, name: "birthDate" });
  const grade = useWatch({ control: form.control, name: "grade" });
  const age = ageFromBirthDate(birthDate, today);
  return (
    <FormSection title="خاص بالطالب">
      <Row>
        <TextField form={form} name="birthDate" label="تاريخ الميلاد" type="date" dir="ltr" />
        <Field>
          <FieldLabel htmlFor="student-age-auto">السن</FieldLabel>
          <Input id="student-age-auto" disabled value={age == null ? "" : `${age} سنة`} readOnly />
        </Field>
      </Row>
      <Row>
        <SelectField form={form} name="study" label="الدراسة" options={STUDY_TYPES} />
        <SelectField form={form} name="grade" label="الصف الدراسي (وقت التقديم)" options={gradeOptions(grade)} />
      </Row>
    </FormSection>
  );
}

export function AdultSection({ form }: { form: StudentForm }) {
  return (
    <FormSection title="بيانات">
      <Row>
        <TextField form={form} name="age" label="السن (سنة)" type="number" min={5} max={110} dir="ltr" />
        <SelectField form={form} name="maritalStatus" label="الحالة الاجتماعية" options={MARITAL_STATUSES} />
      </Row>
      <Row>
        <TextField form={form} name="qualification" label="المؤهل الدراسي" />
        <SelectField form={form} name="qualificationStatus" label="طالب / خريج" options={QUALIFICATION_STATUSES} />
      </Row>
      <Row>
        <TextField form={form} name="job" label="الوظيفة الحالية" />
        <TextField form={form} name="availability" label="الوقت المتاح للحضور" />
      </Row>
    </FormSection>
  );
}

export function ContactSection({ form }: { form: StudentForm }) {
  return (
    <FormSection title="العنوان والتواصل">
      <TextField form={form} name="address" label="العنوان" />
      <Row>
        <TextField form={form} name="phone" label="رقم الهاتف" type="tel" dir="ltr" />
        <TextField form={form} name="whatsapp" label="واتساب" type="tel" dir="ltr" placeholder="إن اختلف عن الهاتف" />
      </Row>
    </FormSection>
  );
}

export function GuardianSection({ form }: { form: StudentForm }) {
  const relation = useWatch({ control: form.control, name: "guardianRelation" });
  return (
    <FormSection title="خاص بولي الأمر">
      <Row>
        <TextField form={form} name="guardianName" label="اسم ولي الأمر" />
        <TextField form={form} name="guardianJob" label="الوظيفة" />
      </Row>
      <Row>
        <TextField form={form} name="guardianPhone" label="رقم الهاتف" type="tel" dir="ltr" />
        <TextField form={form} name="guardianWhatsapp" label="واتساب" type="tel" dir="ltr" placeholder="إن اختلف عن الهاتف" />
      </Row>
      <Row>
        <SelectField form={form} name="guardianRelation" label="صلة القرابة" options={GUARDIAN_RELATIONS} />
        {relation === "شخص آخر" && <TextField form={form} name="guardianRelationOther" label="حدّد صلة القرابة" />}
      </Row>
    </FormSection>
  );
}

export function PlacementSection({ form }: { form: StudentForm }) {
  return (
    <FormSection title="اختبار تحديد مستوى">
      <Row cols={3}>
        <SelectField form={form} name="testReading" label="قراءة" options={GRADES} />
        <SelectField form={form} name="testTajweed" label="تجويد" options={GRADES} />
        <TextField form={form} name="testHifz" label="حفظ" placeholder="مثال: جزء عم" />
      </Row>
    </FormSection>
  );
}

/** قرار المسؤول: the place select only narrows the halaqa list; it is not stored. */
export function DecisionSection({
  form,
  halaqat,
  places,
  child,
}: {
  form: StudentForm;
  halaqat: HalaqaChoice[];
  places: PlaceOption[];
  child: boolean;
}) {
  const halaqaId = useWatch({ control: form.control, name: "halaqaId" });
  const [placeId, setPlaceId] = useState(() => halaqat.find((h) => h.id === halaqaId)?.placeId ?? "");
  const visible = halaqat.filter((h) => !placeId || h.placeId === placeId);

  const choosePlace = (id: string) => {
    setPlaceId(id);
    // A halaqa outside the chosen place cannot stay selected.
    if (id && halaqaId && halaqat.find((h) => h.id === halaqaId)?.placeId !== id) {
      form.setValue("halaqaId", "", { shouldDirty: true });
    }
  };
  const halaqaField = form.register("halaqaId", {
    onChange: (e: { target: { value: string } }) => {
      const place = halaqat.find((h) => h.id === e.target.value)?.placeId;
      if (place) setPlaceId(place);
    },
  });

  return (
    <FormSection title="قرار المسؤول">
      <Row>
        <Field>
          <FieldLabel htmlFor="student-halaqaId">ينضم لحلقة</FieldLabel>
          <NativeSelect id="student-halaqaId" className="w-full" {...halaqaField}>
            <NativeSelectOption value="">— لم يُحدَّد بعد —</NativeSelectOption>
            {visible.map((h) => (
              <NativeSelectOption key={h.id} value={h.id}>
                {h.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="student-place">في</FieldLabel>
          <NativeSelect id="student-place" className="w-full" value={placeId} onChange={(e) => choosePlace(e.target.value)}>
            <NativeSelectOption value="">— كل الأماكن —</NativeSelectOption>
            {places.map((p) => (
              <NativeSelectOption key={p.id} value={p.id}>
                {p.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </Row>
      <Row>
        <TextField form={form} name="joinDate" label="تحرر يوم" type="date" dir="ltr" />
        <TextField form={form} name="monthlyFee" label="الاشتراك الشهري (جنيه)" type="number" min={0} dir="ltr" />
      </Row>
      <Controller
        control={form.control}
        name="pledgeSigned"
        render={({ field }) => (
          <Field orientation="horizontal">
            <Checkbox id="student-pledge" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
            <FieldLabel htmlFor="student-pledge" className="font-normal">
              {child ? "وقّع ولي الأمر على التنبيهات" : "وقّع المتقدم على التنبيهات"}
            </FieldLabel>
          </Field>
        )}
      />
    </FormSection>
  );
}

/**
 * Admin-defined fields. Edited as one object because their keys are free text
 * and must not be read as nested paths by the form library.
 */
export function ExtraSection({ form, fields }: { form: StudentForm; fields: CustomFieldDef[] }) {
  if (fields.length === 0) return null;
  return (
    <FormSection title="بيانات إضافية">
      <Controller
        control={form.control}
        name="extra"
        render={({ field }) => {
          const set = (key: string, value: string) => field.onChange({ ...field.value, [key]: value });
          return (
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((f, i) => {
                const id = `student-extra-${i}`;
                const value = field.value[f.key] ?? "";
                return (
                  <Field key={f.key} className={f.type === "TEXTAREA" ? "sm:col-span-2" : undefined}>
                    <FieldLabel htmlFor={id}>{f.label}</FieldLabel>
                    {f.type === "TEXTAREA" ? (
                      <Textarea id={id} rows={3} value={value} onChange={(e) => set(f.key, e.target.value)} />
                    ) : (
                      <Input
                        id={id}
                        type={f.type === "NUMBER" ? "number" : f.type === "DATE" ? "date" : "text"}
                        dir={f.type === "TEXT" ? undefined : "ltr"}
                        value={value}
                        onChange={(e) => set(f.key, e.target.value)}
                      />
                    )}
                  </Field>
                );
              })}
            </div>
          );
        }}
      />
    </FormSection>
  );
}
