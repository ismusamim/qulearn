"use client";

import { Link2Icon, PauseIcon, PencilIcon, PlayIcon, PlusIcon, Trash2Icon, UsersIcon } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAction } from "@/hooks/use-action";

import { autoLinkEmployeesAction, deleteEmployeeAction, setEmployeeStatusAction } from "../actions";
import { formatAmount, formatHours } from "../constants";
import type { EmployeesOverviewDTO } from "../employees-service";
import { EmployeeFormDialog } from "./employee-form-dialog";
import { statusMessage } from "./status-message";

export function EmployeesTable({ overview }: { overview: EmployeesOverviewDTO }) {
  const { employees, members, nextCode, defaultHours, autoLinkable } = overview;
  const setStatus = useAction(setEmployeeStatusAction, { onSuccess: (change) => toast.success(statusMessage(change)) });
  const remove = useAction(deleteEmployeeAction, { successMessage: "تم حذف الموظف" });
  const autoLink = useAction(autoLinkEmployeesAction, {
    onSuccess: ({ linked }) => toast.success(linked ? `تم ربط ${linked} موظف بحسابه` : "لا يوجد اسم مطابق لحساب واحد"),
  });
  const formProps = { members, nextCode, defaultHours };

  return (
    <Card>
      <CardHeader>
        <CardTitle>موظفو المرتبات ({employees.length})</CardTitle>
        <CardDescription>
          هذه هي الأسعار الحالية. تُنسخ إلى الشهر عند إنشائه وتبقى ثابتة فيه، فالزيادة الجديدة لا تغيّر الشهور السابقة.
        </CardDescription>
        <CardAction className="flex flex-wrap gap-2">
          {autoLinkable > 0 && (
            <ConfirmDialog
              title={`ربط ${autoLinkable} موظف بحسابه؟`}
              description="يُربط كل موظف بلا حساب بالعضو الوحيد (معلم أو مشرف أو مدير أو محاسب) الذي يحمل الاسم نفسه."
              confirmLabel="ربط"
              onConfirm={() => autoLink.execute(undefined)}
            >
              <Button size="sm" variant="outline" disabled={autoLink.pending}>
                <Link2Icon />
                ربط تلقائي بالحسابات ({autoLinkable})
              </Button>
            </ConfirmDialog>
          )}
          <EmployeeFormDialog {...formProps}>
            <Button size="sm">
              <PlusIcon />
              موظف
            </Button>
          </EmployeeFormDialog>
        </CardAction>
      </CardHeader>
      <CardContent>
        {employees.length === 0 ? (
          <EmptyState icon={UsersIcon} title="لا يوجد موظفون" description="أضف الموظفين بأسعارهم الحالية ثم أنشئ كشف الشهر." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الكود</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>الوظيفة</TableHead>
                <TableHead>نظام العمل</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>الأساسي</TableHead>
                <TableHead>سعر الإضافي</TableHead>
                <TableHead>الحافز</TableHead>
                <TableHead>البدل</TableHead>
                <TableHead>الساعات</TableHead>
                <TableHead>الحساب</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((e) => {
                const stopped = e.status === "STOPPED";
                return (
                  <TableRow key={e.id} className={stopped ? "text-muted-foreground" : undefined}>
                    <TableCell dir="ltr" className="text-end">
                      {e.code}
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap">
                      {e.name}
                      {e.place && <div className="text-xs font-normal text-muted-foreground">{e.place}</div>}
                    </TableCell>
                    <TableCell>{e.jobTitle}</TableCell>
                    <TableCell>{e.workSystem || "—"}</TableCell>
                    <TableCell>{stopped ? <Badge variant="destructive">متوقف</Badge> : "عامل"}</TableCell>
                    <TableCell dir="ltr" className="text-end tabular-nums">
                      {formatAmount(e.basic)}
                    </TableCell>
                    <TableCell dir="ltr" className="text-end tabular-nums">
                      {formatAmount(e.rate)}
                    </TableCell>
                    <TableCell dir="ltr" className="text-end tabular-nums">
                      {formatAmount(e.incentive)}
                    </TableCell>
                    <TableCell dir="ltr" className="text-end tabular-nums">
                      {formatAmount(e.transport)}
                    </TableCell>
                    <TableCell dir="ltr" className="text-end tabular-nums">
                      {formatHours(e.hours)}
                    </TableCell>
                    <TableCell className="text-xs">{e.memberLabel ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <EmployeeFormDialog employee={e} {...formProps}>
                          <Button variant="ghost" size="icon-sm" aria-label={`تعديل ${e.name}`}>
                            <PencilIcon />
                          </Button>
                        </EmployeeFormDialog>
                        <ConfirmDialog
                          title={stopped ? `إعادة «${e.name}» عاملًا؟` : `إيقاف «${e.name}»؟`}
                          description={
                            stopped
                              ? "يُضاف إلى كشف آخر شهر مفتوح بأسعاره الحالية."
                              : "يخرج من كشف الشهر المفتوح (الشهور المغلقة لا تُمس)، ويمكن إعادته عاملًا في أي وقت."
                          }
                          confirmLabel={stopped ? "إعادة" : "إيقاف"}
                          destructive={!stopped}
                          onConfirm={() => setStatus.execute({ id: e.id, status: stopped ? "ACTIVE" : "STOPPED" })}
                        >
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={stopped ? `إعادة ${e.name} عاملًا` : `إيقاف ${e.name}`}
                            disabled={setStatus.pending}
                          >
                            {stopped ? <PlayIcon className="text-success" /> : <PauseIcon />}
                          </Button>
                        </ConfirmDialog>
                        {e.rowCount === 0 && (
                          <ConfirmDialog
                            title={`حذف «${e.name}»؟`}
                            description="ليس له رواتب مسجلة. يُحذف معه ما سُجّل له من غياب."
                            confirmLabel="حذف"
                            destructive
                            onConfirm={() => remove.execute({ id: e.id })}
                          >
                            <Button variant="ghost" size="icon-sm" aria-label={`حذف ${e.name}`} disabled={remove.pending}>
                              <Trash2Icon className="text-destructive" />
                            </Button>
                          </ConfirmDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
