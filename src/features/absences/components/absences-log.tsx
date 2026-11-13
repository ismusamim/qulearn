"use client";

import { useState } from "react";

import { Trash2Icon } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PeriodSelect } from "@/features/payroll/components/period-select";
import { useAction } from "@/hooks/use-action";
import { normalizeArabic } from "@/lib/arabic";
import { weekdayName } from "@/lib/dates";

import { deleteAbsenceAction, setAbsenceProofAction } from "../actions";
import { type AbsencePermission, PERMISSION_LABELS, PROOF_LABELS } from "../constants";
import type { AbsenceMonthDTO } from "../service";

type PermissionFilter = "" | AbsencePermission | "NONE";

/** The absences charged to one payroll month, with the per-teacher summary under it. */
export function AbsencesLog({ data }: { data: AbsenceMonthDTO }) {
  const { absences, summary, isAdmin } = data;
  const [query, setQuery] = useState("");
  const [permission, setPermission] = useState<PermissionFilter>("");
  const setProof = useAction(setAbsenceProofAction, { successMessage: "تم حفظ الإثبات" });
  const remove = useAction(deleteAbsenceAction, { successMessage: "تم حذف سجل الغياب" });

  const q = normalizeArabic(query);
  const shown = absences.filter(
    (a) =>
      (!q || normalizeArabic(`${a.name} ${a.place}`).includes(q)) &&
      (!permission || (permission === "NONE" ? !a.permission : a.permission === permission)),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>سجل الغياب</CardTitle>
        <CardAction className="flex flex-wrap items-center gap-2">
          <PeriodSelect years={data.years} year={data.year} month={data.month} />
          <Badge variant="secondary">{absences.length} يوم</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {absences.length === 0 ? (
          <EmptyState title="لا يوجد غياب مسجل في هذا الشهر." />
        ) : (
          <>
            <div className="no-print flex flex-wrap gap-2">
              <Input
                className="max-w-xs"
                placeholder="بحث باسم المعلم أو المكان…"
                aria-label="بحث"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <NativeSelect aria-label="الإذن" value={permission} onChange={(e) => setPermission(e.target.value as PermissionFilter)}>
                <NativeSelectOption value="">كل الحالات</NativeSelectOption>
                <NativeSelectOption value="WITH_PERMISSION">{PERMISSION_LABELS.WITH_PERMISSION}</NativeSelectOption>
                <NativeSelectOption value="WITHOUT_PERMISSION">{PERMISSION_LABELS.WITHOUT_PERMISSION}</NativeSelectOption>
                <NativeSelectOption value="NONE">غير محدد</NativeSelectOption>
              </NativeSelect>
            </div>
            <div className="max-h-[520px] overflow-y-auto print:max-h-none">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>اليوم</TableHead>
                    <TableHead>المعلم</TableHead>
                    <TableHead>المكان</TableHead>
                    <TableHead>الإذن</TableHead>
                    <TableHead>السبب</TableHead>
                    {isAdmin && <TableHead>الإثبات</TableHead>}
                    <TableHead>ملاحظات</TableHead>
                    <TableHead className="no-print w-0" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <b>{weekdayName(a.date)}</b>
                        <div className="text-xs text-muted-foreground" dir="ltr">
                          {a.date}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell>{a.place || "—"}</TableCell>
                      <TableCell>
                        {a.permission ? (
                          <Badge variant={a.permission === "WITH_PERMISSION" ? "secondary" : "destructive"}>
                            {PERMISSION_LABELS[a.permission]}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>{a.reason || "—"}</TableCell>
                      {isAdmin && (
                        <TableCell>
                          <NativeSelect
                            size="sm"
                            aria-label={`إثبات غياب ${a.name}`}
                            value={a.proof ?? ""}
                            disabled={setProof.pending}
                            onChange={(e) => setProof.execute({ id: a.id, proof: e.target.value })}
                          >
                            <NativeSelectOption value="">—</NativeSelectOption>
                            <NativeSelectOption value="BALANCE">{PROOF_LABELS.BALANCE}</NativeSelectOption>
                            <NativeSelectOption value="PROVEN">{PROOF_LABELS.PROVEN}</NativeSelectOption>
                          </NativeSelect>
                        </TableCell>
                      )}
                      <TableCell className="max-w-56 whitespace-normal">
                        {a.note}
                        {a.recordedByName && <div className="text-xs text-muted-foreground">سجّله: {a.recordedByName}</div>}
                      </TableCell>
                      <TableCell className="no-print">
                        {a.canDelete && (
                          <ConfirmDialog
                            title="حذف سجل الغياب؟"
                            description={`${a.name} — ${weekdayName(a.date)} ${a.date}`}
                            confirmLabel="حذف"
                            destructive
                            onConfirm={() => remove.execute({ id: a.id })}
                          >
                            <Button variant="ghost" size="icon-sm" aria-label={`حذف غياب ${a.name}`} disabled={remove.pending}>
                              <Trash2Icon className="text-destructive" />
                            </Button>
                          </ConfirmDialog>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {shown.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">لا توجد نتائج مطابقة.</p>}
            </div>

            <h3 className="font-semibold">ملخص الشهر</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المعلم</TableHead>
                  <TableHead className="text-center">أيام الغياب</TableHead>
                  <TableHead className="text-center">بإذن</TableHead>
                  <TableHead className="text-center">بغير إذن</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.map((s) => (
                  <TableRow key={s.employeeId}>
                    <TableCell>{s.name}</TableCell>
                    <TableCell className="text-center font-bold text-primary">{s.days}</TableCell>
                    <TableCell className="text-center">{s.withPermission}</TableCell>
                    <TableCell className="text-center">{s.withoutPermission}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
