"use client";

import { type ReactNode, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAction } from "@/hooks/use-action";
import type { CustomFieldDef } from "@/server/directory";

import { updateMyExtraAction, updateMyPersonalAction, updateMyTechnicalAction } from "../actions";
import { personalFormValues, technicalFormValues } from "../form-values";
import { PROFILE_SECTIONS } from "../profile";
import {
  type MyPersonalInput,
  type MyPersonalValues,
  type MyTechnicalInput,
  type MyTechnicalValues,
  myPersonalSchema,
  myTechnicalSchema,
} from "../schemas";
import type { TeacherFileDTO } from "../service";
import { AdministrativeSummary } from "./administrative-summary";
import { ExtraFields, SectionFields } from "./profile-fields";

/** «ملفي»: the teacher edits the personal and technical sections; the administrative one is read-only. */
export function MyProfile({ teacher, customFields }: { teacher: TeacherFileDTO; customFields: CustomFieldDef[] }) {
  return (
    <Card>
      <CardContent>
        <Tabs defaultValue="personal" className="gap-5">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="personal">{PROFILE_SECTIONS.personal.label}</TabsTrigger>
            <TabsTrigger value="administrative">{PROFILE_SECTIONS.administrative.label}</TabsTrigger>
            <TabsTrigger value="technical">{PROFILE_SECTIONS.technical.label}</TabsTrigger>
            {customFields.length > 0 && <TabsTrigger value="extra">بيانات إضافية</TabsTrigger>}
          </TabsList>
          <TabsContent value="personal">
            <PersonalForm teacher={teacher} />
          </TabsContent>
          <TabsContent value="administrative" className="flex flex-col gap-4">
            <AdministrativeSummary teacher={teacher} />
            <p className="text-sm text-muted-foreground">هذه البيانات تُدار من قِبل الإدارة، ويمكنك الاطلاع عليها فقط.</p>
          </TabsContent>
          <TabsContent value="technical">
            <TechnicalForm teacher={teacher} />
          </TabsContent>
          {customFields.length > 0 && (
            <TabsContent value="extra">
              <ExtraForm teacher={teacher} customFields={customFields} />
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function SaveRow({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <div>
      <Button type="submit" disabled={pending}>
        {pending && <Spinner />}
        {children}
      </Button>
    </div>
  );
}

function PersonalForm({ teacher }: { teacher: TeacherFileDTO }) {
  const form = useForm<MyPersonalInput, unknown, MyPersonalValues>({
    resolver: zodResolver(myPersonalSchema),
    defaultValues: personalFormValues(teacher),
  });
  const save = useAction(updateMyPersonalAction, { successMessage: "تم حفظ البيانات الشخصية" });
  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit((values) => save.execute(values))} noValidate className="flex flex-col gap-5">
        <SectionFields section="personal" idPrefix="my" />
        <SaveRow pending={save.pending}>حفظ {PROFILE_SECTIONS.personal.title}</SaveRow>
      </form>
    </FormProvider>
  );
}

function TechnicalForm({ teacher }: { teacher: TeacherFileDTO }) {
  const form = useForm<MyTechnicalInput, unknown, MyTechnicalValues>({
    resolver: zodResolver(myTechnicalSchema),
    defaultValues: technicalFormValues(teacher),
  });
  const save = useAction(updateMyTechnicalAction, { successMessage: "تم حفظ البيانات الفنية" });
  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit((values) => save.execute(values))} noValidate className="flex flex-col gap-5">
        <SectionFields section="technical" idPrefix="my" />
        <SaveRow pending={save.pending}>حفظ {PROFILE_SECTIONS.technical.title}</SaveRow>
      </form>
    </FormProvider>
  );
}

function ExtraForm({ teacher, customFields }: { teacher: TeacherFileDTO; customFields: CustomFieldDef[] }) {
  const [extra, setExtra] = useState(teacher.extra);
  const save = useAction(updateMyExtraAction, { successMessage: "تم حفظ البيانات الإضافية" });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.execute({ extra });
      }}
      className="flex flex-col gap-5"
    >
      <ExtraFields fields={customFields} values={extra} onChange={setExtra} idPrefix="my" />
      <SaveRow pending={save.pending}>حفظ البيانات الإضافية</SaveRow>
    </form>
  );
}
