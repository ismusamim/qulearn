"use client";

import { useState } from "react";

import { CheckIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAction } from "@/hooks/use-action";

import { approvePendingAction, deletePendingAction, savePendingAction } from "../actions";
import { FIELD_TYPE_LABELS, FIELD_TYPES, type FieldTarget, type FieldType, KIND_LABELS } from "../fields";
import { DESTINATION_NEW } from "../schemas";
import type { PendingColumnDTO } from "../pending-service";

/**
 * One imported column awaiting a decision: rename it, pick its type, correct
 * values, then approve it as a new field or copy it into an existing one.
 */
export function PendingCard({ column, targets }: { column: PendingColumnDTO; targets: FieldTarget[] }) {
  const [header, setHeader] = useState(column.header);
  const [type, setType] = useState<FieldType>(column.type);
  const [destination, setDestination] = useState(DESTINATION_NEW);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(column.values.map((v) => [v.memberId, v.value])));

  const save = useAction(savePendingAction, { successMessage: "حُفظت التعديلات" });
  const approve = useAction(approvePendingAction, {
    onSuccess: ({ applied }: { applied: number }) => toast.success(`تم الاعتماد — ${applied} قيمة`),
  });
  const remove = useAction(deletePendingAction, { successMessage: "حُذف العمود" });
  const pending = save.pending || approve.pending || remove.pending;

  const payload = () => ({
    id: column.id,
    header,
    values: column.values.map((v) => ({ memberId: v.memberId, value: values[v.memberId] ?? "" })),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>العمود «{column.header}»</CardTitle>
        <CardAction>
          <Badge variant="secondary">
            {KIND_LABELS[column.kind]} — <span dir="ltr">{column.date}</span>
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor={`pl-${column.id}`}>اسم الحقل</FieldLabel>
            <Input id={`pl-${column.id}`} value={header} onChange={(e) => setHeader(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`pt-${column.id}`}>النوع</FieldLabel>
            <NativeSelect
              id={`pt-${column.id}`}
              className="w-full"
              value={type}
              disabled={destination !== DESTINATION_NEW}
              onChange={(e) => setType(e.target.value as FieldType)}
            >
              {FIELD_TYPES.map((t) => (
                <NativeSelectOption key={t} value={t}>
                  {FIELD_TYPE_LABELS[t]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor={`pd-${column.id}`}>الوجهة</FieldLabel>
            <NativeSelect id={`pd-${column.id}`} className="w-full" value={destination} onChange={(e) => setDestination(e.target.value)}>
              <NativeSelectOption value={DESTINATION_NEW}>إنشاء حقل جديد بهذا الاسم</NativeSelectOption>
              {targets.map((t) => (
                <NativeSelectOption key={t.id} value={t.id}>
                  ربط بالحقل الموجود: {t.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        </div>

        {column.values.length === 0 ? (
          <EmptyState title="لم يعد أصحاب هذه القيم موجودين." />
        ) : (
          <div className="max-h-96 overflow-y-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>العضو</TableHead>
                  <TableHead>القيمة (يمكن تعديلها)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {column.values.map((v) => (
                  <TableRow key={v.memberId}>
                    <TableCell>{v.name}</TableCell>
                    <TableCell>
                      <Input
                        aria-label={`قيمة ${v.name}`}
                        value={values[v.memberId] ?? ""}
                        onChange={(e) => setValues((prev) => ({ ...prev, [v.memberId]: e.target.value }))}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={() => approve.execute({ ...payload(), type, destination })}>
          {approve.pending ? <Spinner /> : <CheckIcon />}
          اعتماد
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => save.execute({ ...payload(), type })}>
          {save.pending ? <Spinner /> : <SaveIcon />}
          حفظ التعديلات
        </Button>
        <ConfirmDialog
          title="حذف بيانات هذا العمود نهائيًا دون اعتمادها؟"
          confirmLabel="حذف"
          destructive
          onConfirm={() => remove.execute({ id: column.id })}
        >
          <Button type="button" variant="destructive" disabled={pending}>
            <Trash2Icon />
            حذف
          </Button>
        </ConfirmDialog>
      </CardFooter>
    </Card>
  );
}
