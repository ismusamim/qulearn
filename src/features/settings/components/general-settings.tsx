"use client";

import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useAction } from "@/hooks/use-action";

import { updateOrgAction, updatePublicNameSearchAction } from "../actions";
import { type OrgInput, orgSchema } from "../schemas";

export function GeneralSettings({ org, publicNameSearch }: { org: string; publicNameSearch: boolean }) {
  const form = useForm<OrgInput>({ resolver: zodResolver(orgSchema), defaultValues: { org } });
  const saveOrg = useAction(updateOrgAction, {
    successMessage: "تم حفظ اسم المؤسسة",
    onSuccess: () => form.reset(form.getValues()),
  });

  // Optimistic: the switch moves at once and goes back if the server refuses.
  const [suggest, setSuggest] = useState(publicNameSearch);
  const saveSuggest = useAction(updatePublicNameSearchAction, {
    successMessage: "تم الحفظ",
    onError: () => setSuggest((value) => !value),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>الإعدادات العامة</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <form onSubmit={form.handleSubmit((values) => saveOrg.execute(values))}>
            <Field data-invalid={!!form.formState.errors.org}>
              <FieldLabel htmlFor="settings-org">اسم المؤسسة</FieldLabel>
              <div className="flex flex-wrap gap-2">
                <Input
                  id="settings-org"
                  className="min-w-0 flex-1 sm:max-w-md"
                  {...form.register("org")}
                  aria-invalid={!!form.formState.errors.org}
                />
                <Button type="submit" disabled={saveOrg.pending || !form.formState.isDirty}>
                  {saveOrg.pending && <Spinner />}
                  حفظ
                </Button>
              </div>
              <FieldError errors={[form.formState.errors.org]} />
              <FieldDescription>
                يظهر في صفحة الدخول والشريط الجانبي وعناوين الصفحات. كلمات مرور الإداريين تُدار من «الأعضاء».
              </FieldDescription>
            </Field>
          </form>
          <FieldSeparator />
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="settings-suggest">اقتراح الأسماء في صفحة الدخول</FieldLabel>
              <FieldDescription>
                عند تفعيله تظهر الأسماء المطابقة (مع نوع الحساب فقط) لمن يكتب حرفين فأكثر في صفحة الدخول، ولا يُقترح اسم
                مدير أبدًا. عند إيقافه يكتب كل مستخدم اسمه كاملًا.
              </FieldDescription>
            </FieldContent>
            <Switch
              id="settings-suggest"
              checked={suggest}
              disabled={saveSuggest.pending}
              onCheckedChange={(enabled) => {
                setSuggest(enabled);
                saveSuggest.execute({ enabled });
              }}
            />
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
