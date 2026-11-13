"use client";

import { Fragment, useState } from "react";

import { PlusIcon, RotateCcwIcon } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAction } from "@/hooks/use-action";
import { PERMISSIONS, permissionDefault } from "@/lib/permissions";

import { resetRolePermissionsAction, setRolePermissionsAction } from "../actions";
import { FIXED_TASKS, GRANT_ROLES, GRANT_ROLE_PLURALS, type RoleSetting, TASK_GROUPS, roleAllows } from "../matrix";

/**
 * Every task of the app by role: fixed ones (read-only) and grantable
 * permissions with a switch per role. Remounted by the page whenever the stored
 * settings change, which drops the optimistic state below.
 */
export function PermissionsMatrix({ roleSettings, onAdd }: { roleSettings: RoleSetting[]; onAdd: () => void }) {
  // Switches move at once; the value from the server replaces this on the next render of the page.
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const save = useAction(setRolePermissionsAction, { successMessage: "حُفظ", onError: () => setOptimistic({}) });
  const reset = useAction(resetRolePermissionsAction, {
    successMessage: "عادت صلاحيات الفئات إلى الافتراضي",
    onSuccess: () => setOptimistic({}),
  });
  const customised = roleSettings.some((s) => s.allowed !== permissionDefault(s.role, s.permission));

  return (
    <Card>
      <CardHeader>
        <CardTitle>مهام التطبيق والصلاحيات</CardTitle>
        <CardDescription>
          «أساسية» تملكها الفئة دائمًا، و«للمدير فقط» لا تُمنح لغيره، والمفاتيح صلاحيات قابلة للتوزيع على الفئة كلها. المدير
          يملك كل المهام دائمًا، والخادم يتحقق من كل صلاحية.
        </CardDescription>
        <CardAction className="flex flex-wrap gap-2">
          <ConfirmDialog
            title="استعادة الصلاحيات الافتراضية؟"
            description="تعود صلاحيات كل فئة إلى وضعها الافتراضي. الصلاحيات الخاصة بالأفراد تبقى كما هي، وتُلغى من جدولها أدناه."
            confirmLabel="استعادة"
            destructive
            onConfirm={() => reset.execute(undefined)}
          >
            <Button variant="outline" size="sm" disabled={!customised || reset.pending}>
              <RotateCcwIcon />
              الافتراضي
            </Button>
          </ConfirmDialog>
          <Button size="sm" onClick={onAdd}>
            <PlusIcon />
            إضافة صلاحية
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>المهمة</TableHead>
              {GRANT_ROLES.map((role) => (
                <TableHead key={role} className="text-center">
                  {GRANT_ROLE_PLURALS[role]}
                </TableHead>
              ))}
              <TableHead className="text-center">النوع</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {TASK_GROUPS.map((group) => (
              <Fragment key={group}>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableCell colSpan={GRANT_ROLES.length + 2} className="font-semibold text-primary">
                    {group}
                  </TableCell>
                </TableRow>
                {FIXED_TASKS.filter((task) => task.group === group).map((task) => (
                  <TableRow key={task.label}>
                    <TableCell className="whitespace-normal">{task.label}</TableCell>
                    {GRANT_ROLES.map((role) => (
                      <TableCell key={role} className="text-center">
                        {task.roles.includes(role) ? (
                          <Badge variant="secondary" title="أساسية لهذه الفئة">
                            أساسية
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {task.roles.length > 0 ? "ثابتة" : <Badge variant="outline">للمدير فقط</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
                {PERMISSIONS.filter((permission) => permission.group === group).map((permission) => (
                  <TableRow key={permission.key}>
                    <TableCell className="whitespace-normal">
                      <span className="font-semibold">{permission.label}</span>
                      <span className="block text-xs text-muted-foreground">{permission.description}</span>
                    </TableCell>
                    {GRANT_ROLES.map((role) => {
                      const id = `${role}:${permission.key}`;
                      const checked = optimistic[id] ?? roleAllows(roleSettings, role, permission.key);
                      const byDefault = permissionDefault(role, permission.key);
                      return (
                        <TableCell key={role} className="text-center">
                          <Switch
                            checked={checked}
                            aria-label={`${permission.label} — ${GRANT_ROLE_PLURALS[role]}`}
                            onCheckedChange={(allowed) => {
                              setOptimistic((current) => ({ ...current, [id]: allowed }));
                              save.execute({ role, permissions: [{ permission: permission.key, allowed }] });
                            }}
                          />
                          <span className="mt-1 block text-[0.7rem] text-muted-foreground">
                            {checked === byDefault ? (byDefault ? "افتراضية" : " ") : byDefault ? "مسحوبة" : "ممنوحة"}
                          </span>
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center text-xs text-muted-foreground">قابلة للتوزيع</TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
        <p className="mt-3 text-xs text-muted-foreground">
          تحت كل مفتاح حالته بالنسبة للوضع الافتراضي: «افتراضية» تملكها الفئة أصلًا، «ممنوحة» أضفتها أنت، «مسحوبة» كانت للفئة
          وسحبتها.
        </p>
      </CardContent>
    </Card>
  );
}
