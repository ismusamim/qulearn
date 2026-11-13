"use client";

import { type ReactNode, useState } from "react";

import Link from "next/link";

import { zodResolver } from "@hookform/resolvers/zod";
import { CopyIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";

import { createTeacherAction } from "../actions";
import { type CreateTeacherInput, createTeacherSchema } from "../schemas";

interface Created {
  id: string;
  name: string;
  password: string | null;
}

/** Adds a teacher, then shows the generated password — the only time it can be seen. */
export function TeacherCreateDialog({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const form = useForm<CreateTeacherInput>({
    resolver: zodResolver(createTeacherSchema),
    defaultValues: { name: "", phone: "" },
  });
  const create = useAction(createTeacherAction, {
    onSuccess: (teacher) => {
      setCreated(teacher);
      form.reset();
    },
  });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setCreated(null);
  }

  async function copyPassword(password: string) {
    try {
      await navigator.clipboard.writeText(password);
      toast.success("نُسخت كلمة المرور");
    } catch {
      toast.error("تعذّر النسخ، انسخها يدويًا");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {created ? (
          <div className="flex flex-col gap-5">
            <DialogHeader>
              <DialogTitle>تم إنشاء حساب «{created.name}»</DialogTitle>
              <DialogDescription>
                سلّم المعلم كلمة المرور الآن؛ لن تظهر مرة أخرى بعد إغلاق هذه النافذة.
              </DialogDescription>
            </DialogHeader>
            {created.password && (
              <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3">
                <span className="text-sm text-muted-foreground">كلمة المرور</span>
                <span dir="ltr" className="font-mono text-xl font-bold tracking-widest">
                  {created.password}
                </span>
                <Button type="button" variant="outline" size="sm" onClick={() => copyPassword(created.password ?? "")}>
                  <CopyIcon />
                  نسخ
                </Button>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                إغلاق
              </Button>
              <Button asChild>
                <Link href={`/teachers/${created.id}`}>استكمال بياناته</Link>
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit((values) => create.execute(values))} className="flex flex-col gap-5">
            <DialogHeader>
              <DialogTitle>معلم جديد</DialogTitle>
              <DialogDescription>تُنشأ له كلمة مرور من ستة أرقام تظهر بعد الحفظ.</DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <Field data-invalid={!!form.formState.errors.name}>
                <FieldLabel htmlFor="teacher-new-name">الاسم</FieldLabel>
                <Input id="teacher-new-name" {...form.register("name")} aria-invalid={!!form.formState.errors.name} />
                <FieldError errors={[form.formState.errors.name]} />
              </Field>
              <Field data-invalid={!!form.formState.errors.phone}>
                <FieldLabel htmlFor="teacher-new-phone">الجوال</FieldLabel>
                <Input id="teacher-new-phone" type="tel" dir="ltr" className="text-end" {...form.register("phone")} />
                <FieldError errors={[form.formState.errors.phone]} />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                إلغاء
              </Button>
              <Button type="submit" disabled={create.pending}>
                {create.pending && <Spinner />}
                حفظ
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
