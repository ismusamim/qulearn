"use client";

import { useState } from "react";

import Link from "next/link";

import { zodResolver } from "@hookform/resolvers/zod";
import { type FieldErrors, FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAction } from "@/hooks/use-action";
import type { CustomFieldDef } from "@/server/directory";

import { updateTeacherAction } from "../actions";
import { teacherFormValues } from "../form-values";
import { PROFILE_SECTIONS, type SectionKey } from "../profile";
import { type TeacherFormInput, type TeacherFormValues, teacherFormSchema } from "../schemas";
import type { TeacherFileDTO } from "../service";
import { ExtraFields, SectionFields } from "./profile-fields";

const SECTIONS: readonly SectionKey[] = ["personal", "administrative", "technical"];

/** The section holding the first invalid field, so a failed save opens the tab that needs fixing. */
function sectionOfError(errors: FieldErrors<TeacherFormInput>): SectionKey {
  const names = new Set(Object.keys(errors));
  return SECTIONS.find((s) => PROFILE_SECTIONS[s].fields.some((f) => names.has(f.name))) ?? "personal";
}

/** «تعديل بيانات»: the administration edits the name and all sections of a teacher's file with one save. */
export function TeacherEditor({ teacher, customFields }: { teacher: TeacherFileDTO; customFields: CustomFieldDef[] }) {
  const [tab, setTab] = useState<string>("personal");
  const [extra, setExtra] = useState(teacher.extra);
  const form = useForm<TeacherFormInput, unknown, TeacherFormValues>({
    resolver: zodResolver(teacherFormSchema),
    defaultValues: teacherFormValues(teacher),
  });
  const save = useAction(updateTeacherAction, {
    onSuccess: ({ name }) => toast.success(`حُفظت بيانات «${name}»`),
  });

  const submit = form.handleSubmit(
    (values) => save.execute({ ...values, id: teacher.id, extra }),
    (errors) => {
      setTab(sectionOfError(errors));
      toast.error("راجع الحقول المظللة");
    },
  );
  const nameError = form.formState.errors.name;

  return (
    <FormProvider {...form}>
      <form onSubmit={submit} noValidate>
        <Card>
          <CardContent>
            <Tabs value={tab} onValueChange={setTab} className="gap-5">
              <TabsList className="h-auto flex-wrap">
                {SECTIONS.map((s) => (
                  <TabsTrigger key={s} value={s}>
                    {PROFILE_SECTIONS[s].label}
                  </TabsTrigger>
                ))}
                {customFields.length > 0 && <TabsTrigger value="extra">بيانات إضافية</TabsTrigger>}
              </TabsList>

              <TabsContent value="personal" className="flex flex-col gap-4">
                <Field data-invalid={!!nameError} className="sm:max-w-[calc(50%-0.5rem)]">
                  <FieldLabel htmlFor="teacher-name">الاسم</FieldLabel>
                  <Input id="teacher-name" aria-invalid={!!nameError} {...form.register("name")} />
                  <FieldError errors={[nameError]} />
                </Field>
                <SectionFields section="personal" idPrefix="teacher" />
              </TabsContent>
              <TabsContent value="administrative" className="flex flex-col gap-4">
                <SectionFields section="administrative" idPrefix="teacher" />
                <p className="text-sm text-muted-foreground">
                  الحالة «متوقف» تمنع المعلم من تسجيل أي شيء ويرى رسالة الإيقاف عند دخوله. هذا القسم يطّلع عليه المعلم ولا
                  يعدّله.
                </p>
              </TabsContent>
              <TabsContent value="technical">
                <SectionFields section="technical" idPrefix="teacher" />
              </TabsContent>
              {customFields.length > 0 && (
                <TabsContent value="extra">
                  <ExtraFields fields={customFields} values={extra} onChange={setExtra} idPrefix="teacher" />
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
          <CardFooter className="gap-2">
            <Button type="submit" disabled={save.pending}>
              {save.pending && <Spinner />}
              حفظ
            </Button>
            <Button asChild type="button" variant="outline">
              <Link href="/teachers">رجوع</Link>
            </Button>
          </CardFooter>
        </Card>
      </form>
    </FormProvider>
  );
}
