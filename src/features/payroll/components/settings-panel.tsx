"use client";

import { KeyRoundIcon, PencilIcon } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { useAction } from "@/hooks/use-action";

import { setPayrollPinAction } from "../actions";
import { RULE_FIELDS } from "../constants";
import type { PayrollSettingsDTO } from "../service";
import { PinFormDialog, RulesFormDialog } from "./settings-dialogs";

export function SettingsPanel({ settings }: { settings: PayrollSettingsDTO }) {
  const removePin = useAction(setPayrollPinAction, { successMessage: "أُلغي رمز قسم المرتبات" });
  const { counts } = settings;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>قواعد الحساب</CardTitle>
          <CardDescription>
            تغيير القواعد يعيد حساب الشهور المفتوحة والمغلقة معًا؛ لذلك لا تغيّرها إلا عند بدء العمل بقاعدة جديدة.
          </CardDescription>
          <CardAction>
            <RulesFormDialog settings={settings}>
              <Button size="sm">
                <PencilIcon />
                تعديل
              </Button>
            </RulesFormDialog>
          </CardAction>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              {RULE_FIELDS.map((f) => (
                <TableRow key={f.key}>
                  <TableCell className="w-[55%] font-medium">{f.label}</TableCell>
                  <TableCell dir="ltr" className="text-end tabular-nums">
                    {settings[f.key]}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRoundIcon className="size-4" />
            رمز قسم المرتبات
            <Badge variant={settings.pinEnabled ? "default" : "secondary"}>{settings.pinEnabled ? "مفعّل" : "غير مفعّل"}</Badge>
          </CardTitle>
          <CardDescription>حماية إضافية اختيارية: يُطلب الرمز من المدير مرة عند فتح القسم في كل جلسة.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <PinFormDialog enabled={settings.pinEnabled}>
            <Button variant="outline" size="sm">
              {settings.pinEnabled ? "تغيير الرمز" : "تفعيل الرمز"}
            </Button>
          </PinFormDialog>
          {settings.pinEnabled && (
            <ConfirmDialog
              title="إلغاء رمز قسم المرتبات؟"
              description="يصير القسم متاحًا لكل مدير بلا رمز."
              confirmLabel="إلغاء الرمز"
              cancelLabel="تراجع"
              destructive
              onConfirm={() => removePin.execute({ pin: "" })}
            >
              <Button variant="ghost" size="sm" className="text-destructive" disabled={removePin.pending}>
                إلغاء الرمز
              </Button>
            </ConfirmDialog>
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        المسجل حاليًا: {counts.employees} موظف، {counts.rows} صف رواتب، {counts.absences} يوم غياب.
      </p>
    </div>
  );
}
