"use client";

import { useState } from "react";

import { ListPlusIcon, PencilIcon, Trash2Icon } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAction } from "@/hooks/use-action";

import { deleteCustomFieldAction, updateCustomFieldAction } from "../actions";
import { FIELD_TYPE_LABELS, FIELD_TYPES, type FieldType, KIND_LABELS } from "../fields";
import type { CustomFieldDTO } from "../pending-service";

function EditFieldDialog({ field }: { field: CustomFieldDTO }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(field.label);
  const [type, setType] = useState<FieldType>(field.type);
  const update = useAction(updateCustomFieldAction, { successMessage: "تم حفظ التعديلات", onSuccess: () => setOpen(false) });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`تعديل ${field.label}`}>
          <PencilIcon />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            update.execute({ kind: field.kind, key: field.key, label, type });
          }}
        >
          <DialogHeader>
            <DialogTitle>تعديل الحقل: {field.label}</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="field-label">اسم الحقل</FieldLabel>
              <Input id="field-label" value={label} onChange={(e) => setLabel(e.target.value)} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="field-type">النوع</FieldLabel>
              <NativeSelect id="field-type" className="w-full" value={type} onChange={(e) => setType(e.target.value as FieldType)}>
                {FIELD_TYPES.map((t) => (
                  <NativeSelectOption key={t} value={t}>
                    {FIELD_TYPE_LABELS[t]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={update.pending}>
              {update.pending && <Spinner />}
              حفظ
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CustomFieldsTable({ fields }: { fields: CustomFieldDTO[] }) {
  const remove = useAction(deleteCustomFieldAction, { successMessage: "تم حذف الحقل" });

  return (
    <Card>
      <CardHeader>
        <CardTitle>الحقول المضافة</CardTitle>
        <CardDescription>تظهر في «بيانات إضافية» لكل عضو، وتُطابَق تلقائيًا مع أعمدة الملفات في الاستيرادات اللاحقة.</CardDescription>
      </CardHeader>
      <CardContent>
        {fields.length === 0 ? (
          <EmptyState
            icon={ListPlusIcon}
            title="لم تُضف حقول بعد."
            description="تظهر هنا الحقول التي تعتمدها من البيانات المعلّقة."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الحقل</TableHead>
                <TableHead>لـ</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>عدد القيم</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field) => (
                <TableRow key={`${field.kind}:${field.key}`}>
                  <TableCell className="font-medium">{field.label}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{KIND_LABELS[field.kind]}</Badge>
                  </TableCell>
                  <TableCell>{FIELD_TYPE_LABELS[field.type]}</TableCell>
                  <TableCell>{field.usedBy}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <EditFieldDialog key={`${field.label}:${field.type}`} field={field} />
                      <ConfirmDialog
                        title="حذف هذا الحقل وكل قيمه من الأعضاء؟"
                        description={field.usedBy > 0 ? `ستُحذف ${field.usedBy} قيمة مسجّلة، ولا يمكن التراجع.` : "لا يمكن التراجع عن الحذف."}
                        confirmLabel="حذف"
                        destructive
                        onConfirm={() => remove.execute({ kind: field.kind, key: field.key })}
                      >
                        <Button variant="ghost" size="icon-sm" aria-label={`حذف ${field.label}`} disabled={remove.pending}>
                          <Trash2Icon className="text-destructive" />
                        </Button>
                      </ConfirmDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
