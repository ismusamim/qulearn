"use client";

import { UserCogIcon } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAction } from "@/hooks/use-action";
import { PERMISSIONS } from "@/lib/permissions";

import { clearMemberOverridesAction } from "../actions";
import { GRANT_ROLE_LABELS } from "../matrix";
import type { MemberOverrideDTO } from "../service";

const labelOf = (key: string) => PERMISSIONS.find((p) => p.key === key)?.label ?? key;

/** People whose permissions differ from their role's. */
export function MemberOverrides({
  overrides,
  onAdd,
  onEdit,
}: {
  overrides: MemberOverrideDTO[];
  onAdd: () => void;
  onEdit: (memberId: string) => void;
}) {
  const clear = useAction(clearMemberOverridesAction, { successMessage: "أُلغي الاستثناء" });

  return (
    <Card>
      <CardHeader>
        <CardTitle>صلاحيات خاصة بأفراد</CardTitle>
        <CardDescription>
          صلاحية الفرد تتقدّم دائمًا على صلاحية فئته: «+» ممنوحة له ولو لم تملكها فئته، و«−» مسحوبة منه ولو ملكتها فئته.
        </CardDescription>
        <CardAction>
          <Button size="sm" variant="outline" onClick={onAdd}>
            <UserCogIcon />
            صلاحية لشخص
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {overrides.length === 0 ? (
          <EmptyState
            icon={UserCogIcon}
            title="لا توجد صلاحيات خاصة بأفراد"
            description="أضفها من زر «إضافة صلاحية» ثم «لشخص بعينه»."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الشخص</TableHead>
                <TableHead>الصلاحيات الخاصة</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {overrides.map((person) => (
                <TableRow key={person.id}>
                  <TableCell>
                    <span className="font-semibold">{person.name}</span>
                    <span className="block text-xs text-muted-foreground">{GRANT_ROLE_LABELS[person.role]}</span>
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <div className="flex flex-wrap gap-1">
                      {person.permissions.map((choice) => (
                        <Badge key={choice.permission} variant={choice.allowed ? "secondary" : "destructive"}>
                          <span dir="ltr">{choice.allowed ? "+" : "−"}</span> {labelOf(choice.permission)}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="outline" size="sm" onClick={() => onEdit(person.id)}>
                        تعديل
                      </Button>
                      <ConfirmDialog
                        title={`إلغاء استثناء «${person.name}»؟`}
                        description="يعود إلى صلاحيات فئته كما هي."
                        confirmLabel="إلغاء الاستثناء"
                        cancelLabel="رجوع"
                        destructive
                        onConfirm={() => clear.execute({ memberId: person.id })}
                      >
                        <Button variant="destructive" size="sm" disabled={clear.pending}>
                          إلغاء الاستثناء
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
