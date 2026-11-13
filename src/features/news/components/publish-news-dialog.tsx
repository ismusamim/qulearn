"use client";

import { type ReactNode, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { NEWS_AUDIENCE_LABELS } from "@/lib/constants";

import { publishNewsAction } from "../actions";
import { type NewsAudience, type PublishNewsInput, publishNewsSchema } from "../schemas";

/** Audiences an announcement can be addressed to (notes to the admins are sent from «ملاحظات للإدارة»). */
const PUBLISH_AUDIENCES: readonly NewsAudience[] = ["ALL", "TEACHER", "SUPERVISOR", "STUDENT", "ACCOUNTANT"];

/** Admin form for a new announcement. `children` is the button that opens it. */
export function PublishNewsDialog({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const form = useForm<PublishNewsInput>({
    resolver: zodResolver(publishNewsSchema),
    defaultValues: { text: "", audience: "ALL" },
  });
  const publish = useAction(publishNewsAction, {
    successMessage: "تم نشر الإعلان",
    onSuccess: () => {
      setOpen(false);
      form.reset();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={form.handleSubmit((values) => publish.execute(values))} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>إعلان جديد</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={!!form.formState.errors.text}>
              <FieldLabel htmlFor="news-text">النص</FieldLabel>
              <Textarea id="news-text" rows={5} {...form.register("text")} aria-invalid={!!form.formState.errors.text} />
              <FieldError errors={[form.formState.errors.text]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="news-audience">الجمهور</FieldLabel>
              <Controller
                control={form.control}
                name="audience"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="news-audience" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PUBLISH_AUDIENCES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {NEWS_AUDIENCE_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={publish.pending}>
              {publish.pending && <Spinner />}
              نشر
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
