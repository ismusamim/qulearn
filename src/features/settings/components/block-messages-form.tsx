"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";

import { updateBlockMessagesAction } from "../actions";
import { type BlockMessagesInput, blockMessagesSchema } from "../schemas";

/** The notices a dropped student / suspended teacher sees instead of the app. */
export function BlockMessagesForm({ messages }: { messages: { student: string; teacher: string } }) {
  const form = useForm<BlockMessagesInput>({ resolver: zodResolver(blockMessagesSchema), defaultValues: messages });
  const save = useAction(updateBlockMessagesAction, { successMessage: "حُفظت الرسائل" });
  const { errors } = form.formState;

  return (
    <Card>
      <CardHeader>
        <CardTitle>رسائل الحسابات الموقوفة</CardTitle>
        <CardDescription>
          تظهر بدل التطبيق عند دخول صاحب الحساب الموقوف. الطالب يُوقف بجعله «منقطع»، والمعلم بجعل حالته «موقوف» من
          بياناته الإدارية. إن تُركت الرسالة فارغة عاد نصها الافتراضي.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit((values) => save.execute(values))}>
          <FieldGroup>
            <Field data-invalid={!!errors.student}>
              <FieldLabel htmlFor="block-student">رسالة الطالب المنقطع</FieldLabel>
              <Textarea id="block-student" rows={3} {...form.register("student")} aria-invalid={!!errors.student} />
              <FieldError errors={[errors.student]} />
            </Field>
            <Field data-invalid={!!errors.teacher}>
              <FieldLabel htmlFor="block-teacher">رسالة المعلم الموقوف</FieldLabel>
              <Textarea id="block-teacher" rows={3} {...form.register("teacher")} aria-invalid={!!errors.teacher} />
              <FieldError errors={[errors.teacher]} />
            </Field>
            <div>
              <Button type="submit" disabled={save.pending}>
                {save.pending && <Spinner />}
                حفظ الرسائل
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
