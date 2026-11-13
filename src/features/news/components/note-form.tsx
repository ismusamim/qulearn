"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { SendIcon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";

import { sendNoteAction } from "../actions";
import { NOTE_AUDIENCES, NOTE_AUDIENCE_LABELS, type SendNoteInput, sendNoteSchema } from "../schemas";

/** `signature` is only shown to the sender; the server builds the stored one itself. */
export function NoteForm({ signature }: { signature: string }) {
  const form = useForm<SendNoteInput>({
    resolver: zodResolver(sendNoteSchema),
    defaultValues: { audience: "ADMIN", text: "" },
  });
  const send = useAction(sendNoteAction, {
    successMessage: "أُرسلت الملاحظة",
    onSuccess: () => form.reset({ audience: form.getValues("audience"), text: "" }),
  });

  return (
    <form onSubmit={form.handleSubmit((values) => send.execute(values))}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="note-audience">إلى</FieldLabel>
          <Controller
            control={form.control}
            name="audience"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="note-audience" className="w-full sm:w-60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTE_AUDIENCES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {NOTE_AUDIENCE_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field data-invalid={!!form.formState.errors.text}>
          <FieldLabel htmlFor="note-text">الملاحظة</FieldLabel>
          <Textarea
            id="note-text"
            rows={4}
            placeholder="اكتب ملاحظتك بخصوص العمل"
            {...form.register("text")}
            aria-invalid={!!form.formState.errors.text}
          />
          <FieldError errors={[form.formState.errors.text]} />
          <FieldDescription>تظهر في إعلانات من أرسلتها إليه، موقّعة باسمك: «{signature}».</FieldDescription>
        </Field>
        <div>
          <Button type="submit" disabled={send.pending}>
            {send.pending ? <Spinner /> : <SendIcon />}
            إرسال
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
