"use client";

import Link from "next/link";

import { BanIcon, FileTextIcon, KeyRoundIcon, PencilIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROLE_LABELS, type Role } from "@/lib/constants";

import type { MemberRowDTO } from "../service";

/** Where the full form of a student or teacher lives (other roles have none). */
function fileHref(member: MemberRowDTO): string | null {
  if (member.role === "STUDENT") return `/students/${member.id}`;
  if (member.role === "TEACHER") return "/teachers";
  return null;
}

const HALAQA_COLUMN: Partial<Record<Role, string>> = { STUDENT: "الحلقة", TEACHER: "الحلقات", SUPERVISOR: "الحلقات" };

export function MembersTable({
  role,
  members,
  selected,
  busy,
  onToggle,
  onToggleAll,
  onEdit,
  onSetPassword,
  onResetPassword,
  onDisableLogin,
  onDelete,
}: {
  role: Role;
  /** The rows currently shown (after the name search). */
  members: MemberRowDTO[];
  selected: ReadonlySet<string>;
  busy: boolean;
  onToggle: (id: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  onEdit: (member: MemberRowDTO) => void;
  onSetPassword: (member: MemberRowDTO) => void;
  onResetPassword: (member: MemberRowDTO) => void;
  onDisableLogin: (member: MemberRowDTO) => void;
  onDelete: (member: MemberRowDTO) => void;
}) {
  const halaqaColumn = HALAQA_COLUMN[role];
  const chosen = members.filter((m) => selected.has(m.id)).length;
  const allChecked = chosen > 0 && chosen === members.length;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-0">
            <Checkbox
              aria-label="تحديد الكل"
              checked={allChecked ? true : chosen > 0 ? "indeterminate" : false}
              onCheckedChange={(value) => onToggleAll(value === true)}
            />
          </TableHead>
          <TableHead className="w-0">#</TableHead>
          <TableHead>الاسم</TableHead>
          <TableHead>الجوال</TableHead>
          {halaqaColumn && <TableHead>{halaqaColumn}</TableHead>}
          <TableHead>حساب الدخول</TableHead>
          <TableHead className="w-0" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member, index) => {
          const href = fileHref(member);
          return (
            <TableRow key={member.id} data-state={selected.has(member.id) ? "selected" : undefined}>
              <TableCell>
                <Checkbox
                  aria-label={`تحديد ${member.name}`}
                  checked={selected.has(member.id)}
                  onCheckedChange={(value) => onToggle(member.id, value === true)}
                />
              </TableCell>
              <TableCell className="text-muted-foreground">{index + 1}</TableCell>
              <TableCell className="font-medium">
                <div className="flex flex-wrap items-center gap-1.5">
                  {href ? (
                    <Link href={href} className="hover:underline">
                      {member.name}
                    </Link>
                  ) : (
                    member.name
                  )}
                  {member.isSelf && <Badge variant="outline">حسابك</Badge>}
                  {member.dropped && <Badge variant="destructive">منقطع</Badge>}
                  {member.otherRoles.length > 0 && (
                    <Badge variant="secondary" title="نفس الاسم له حساب آخر">
                      + {member.otherRoles.map((r) => ROLE_LABELS[r]).join("، ")}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell dir="ltr" className="text-end text-muted-foreground">
                {member.phone || "—"}
              </TableCell>
              {halaqaColumn && (
                <TableCell className="text-muted-foreground">
                  {role === "STUDENT" ? (member.halaqaLabel ?? "—") : member.halaqat.join("، ") || "—"}
                </TableCell>
              )}
              <TableCell>
                {member.canLogin ? (
                  <Badge variant="secondary" className="text-success">
                    متاح
                  </Badge>
                ) : (
                  <Badge variant="outline">بلا حساب</Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <ConfirmDialog
                    title={
                      member.canLogin
                        ? `إنشاء كلمة مرور جديدة لـ «${member.name}»؟`
                        : `إنشاء حساب دخول لـ «${member.name}»؟`
                    }
                    description={
                      member.canLogin
                        ? "كلمة المرور الحالية محفوظة مشفّرة ولا يمكن عرضها؛ ستتوقف عن العمل وتظهر لك الكلمة الجديدة مرة واحدة."
                        : "ستظهر لك كلمة المرور مرة واحدة لتسليمها لصاحبها."
                    }
                    confirmLabel={member.canLogin ? "كلمة جديدة" : "إنشاء حساب"}
                    onConfirm={() => onResetPassword(member)}
                  >
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={busy}
                      title={member.canLogin ? "كلمة مرور جديدة (تظهر مرة واحدة)" : "إنشاء حساب دخول"}
                      aria-label={`كلمة مرور جديدة لـ ${member.name}`}
                    >
                      <RefreshCwIcon />
                    </Button>
                  </ConfirmDialog>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="تحديد كلمة مرور"
                    aria-label={`تحديد كلمة مرور لـ ${member.name}`}
                    onClick={() => onSetPassword(member)}
                  >
                    <KeyRoundIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="تعديل الاسم والجوال"
                    aria-label={`تعديل ${member.name}`}
                    onClick={() => onEdit(member)}
                  >
                    <PencilIcon />
                  </Button>
                  {href && (
                    <Button asChild variant="ghost" size="icon-sm">
                      <Link
                        href={href}
                        title={role === "STUDENT" ? "استمارة الطالب" : "ملف المعلم"}
                        aria-label={`${role === "STUDENT" ? "استمارة" : "ملف"} ${member.name}`}
                      >
                        <FileTextIcon />
                      </Link>
                    </Button>
                  )}
                  <ConfirmDialog
                    title={`إيقاف دخول «${member.name}»؟`}
                    description="تُحذف كلمة مروره ويُسجَّل خروجه فورًا، ويبقى الحساب وكل سجلاته. يمكنك إنشاء كلمة جديدة له لاحقًا."
                    confirmLabel="إيقاف الدخول"
                    destructive
                    onConfirm={() => onDisableLogin(member)}
                  >
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={busy || !member.canLogin || member.isSelf}
                      title="إيقاف الدخول"
                      aria-label={`إيقاف دخول ${member.name}`}
                    >
                      <BanIcon />
                    </Button>
                  </ConfirmDialog>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={member.isSelf}
                    title={member.isSelf ? "لا يمكنك حذف حسابك الحالي" : "حذف"}
                    aria-label={`حذف ${member.name}`}
                    onClick={() => onDelete(member)}
                  >
                    <Trash2Icon className="text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
