"use client";

import { useMemo, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { PlusIcon, SearchIcon, SendIcon, Trash2Icon, UploadIcon, UserPlusIcon, UsersIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { NativeSelect } from "@/components/ui/native-select";
import { useAction } from "@/hooks/use-action";
import { normalizeArabic } from "@/lib/arabic";
import { ROLE_LABELS, ROLE_PLURAL_LABELS } from "@/lib/constants";

import { disableLoginAction, resetPasswordAction } from "../actions";
import { ROLE_SLUGS, type RoleSlug, slugFromRole } from "../domain";
import { BULK_RESET_LIMIT } from "../schemas";
import type { CredentialDTO, MemberRowDTO, MembersListDTO } from "../service";
import { BulkResetDialog, DeleteMembersDialog } from "./bulk-dialogs";
import { CredentialDialog } from "./credential-dialog";
import { CredentialsPanel } from "./credentials-panel";
import { MemberFormDialog } from "./member-form-dialog";
import { MembersTable } from "./members-table";
import { SetPasswordDialog } from "./set-password-dialog";

type Modal =
  | { kind: "create" }
  | { kind: "edit"; member: MemberRowDTO }
  | { kind: "setPassword"; member: MemberRowDTO }
  | { kind: "delete"; members: MemberRowDTO[] }
  | { kind: "bulkReset"; members: MemberRowDTO[] };

/** The «الأعضاء» section for one role. Remounted (key) when the role changes, so selection never leaks. */
export function MembersView({ list, org }: { list: MembersListDTO; org: string }) {
  const { role, members, counts } = list;
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [modal, setModal] = useState<Modal | null>(null);
  /** New password(s) held in memory only until the admin closes them. */
  const [credential, setCredential] = useState<CredentialDTO | null>(null);
  const [credentials, setCredentials] = useState<CredentialDTO[] | null>(null);

  const reset = useAction(resetPasswordAction, { onSuccess: setCredential });
  const disable = useAction(disableLoginAction, { successMessage: "تم إيقاف الدخول" });

  const visible = useMemo(() => {
    const q = normalizeArabic(query);
    return q ? members.filter((m) => normalizeArabic(m.name).includes(q)) : members;
  }, [members, query]);
  // Ids of members deleted meanwhile drop out of the selection by themselves.
  const chosen = members.filter((m) => selected.has(m.id));
  const withoutLogin = members.filter((m) => !m.canLogin);
  const closeModal = () => setModal(null);

  const toggle = (id: string, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  const toggleAll = (checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const m of visible) {
        if (checked) next.add(m.id);
        else next.delete(m.id);
      }
      return next;
    });

  if (credentials) {
    return <CredentialsPanel credentials={credentials} org={org} onClose={() => setCredentials(null)} />;
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect
            aria-label="فئة الأعضاء"
            className="min-w-44 font-semibold"
            value={slugFromRole(role)}
            onChange={(e) => router.push(`/members?role=${e.target.value}`)}
          >
            {(Object.keys(ROLE_SLUGS) as RoleSlug[]).map((slug) => (
              <option key={slug} value={slug}>
                {ROLE_PLURAL_LABELS[ROLE_SLUGS[slug]]} ({counts[ROLE_SLUGS[slug]]})
              </option>
            ))}
          </NativeSelect>
          <InputGroup className="w-full sm:w-64">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              placeholder="بحث بالاسم"
              aria-label="بحث بالاسم"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </InputGroup>
          <span className="text-sm text-muted-foreground">
            {query.trim() ? `${visible.length} من ${members.length}` : `العدد: ${members.length}`}
            {members.length > 0 && ` — متاح: ${members.length - withoutLogin.length}`}
          </span>
          <div className="ms-auto flex flex-wrap items-center gap-2">
            {chosen.length > 0 && (
              <>
                <Button variant="outline" size="sm" onClick={() => setModal({ kind: "bulkReset", members: chosen })}>
                  <SendIcon />
                  إرسال بيانات الدخول ({chosen.length})
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setModal({ kind: "delete", members: chosen })}>
                  <Trash2Icon />
                  حذف المحدد ({chosen.length})
                </Button>
              </>
            )}
            {chosen.length === 0 && withoutLogin.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModal({ kind: "bulkReset", members: withoutLogin.slice(0, BULK_RESET_LIMIT) })}
              >
                <UserPlusIcon />
                إنشاء حسابات الدخول ({withoutLogin.length})
              </Button>
            )}
            {(role === "TEACHER" || role === "STUDENT") && (
              <Button asChild variant="outline" size="sm">
                <Link href="/import">
                  <UploadIcon />
                  استيراد
                </Link>
              </Button>
            )}
            <Button size="sm" onClick={() => setModal({ kind: "create" })}>
              <PlusIcon />
              {ROLE_LABELS[role]}
            </Button>
          </div>
        </div>
        <CardDescription>
          كلمات المرور محفوظة على الخادم مشفّرة ولا يمكن عرضها؛ تظهر مرة واحدة عند إنشاء الحساب أو تغييرها، فسلّمها
          لأصحابها. بدل «إظهار كلمة المرور» استعمل «كلمة مرور جديدة» فتظهر لك الجديدة مرة واحدة. إذا تكرر الاسم نفسه في
          أكثر من نوع، يظهر لصاحبه خيار تبديل الوضع عند الدخول.
          {role === "SUPERVISOR" && " حدّد حلقات كل مشرف من قسم «الأماكن والحلقات» ← تعديل الحلقة ← المشرف."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <EmptyState icon={UsersIcon} title="لا يوجد أعضاء بعد." />
        ) : visible.length === 0 ? (
          <EmptyState icon={SearchIcon} title="لا توجد نتائج" description="لا يوجد اسم يطابق البحث." />
        ) : (
          <MembersTable
            role={role}
            members={visible}
            selected={selected}
            busy={reset.pending || disable.pending}
            onToggle={toggle}
            onToggleAll={toggleAll}
            onEdit={(member) => setModal({ kind: "edit", member })}
            onSetPassword={(member) => setModal({ kind: "setPassword", member })}
            onResetPassword={(member) => reset.execute({ id: member.id })}
            onDisableLogin={(member) => disable.execute({ id: member.id })}
            onDelete={(member) => setModal({ kind: "delete", members: [member] })}
          />
        )}
      </CardContent>

      {modal?.kind === "create" && <MemberFormDialog role={role} onClose={closeModal} onCreated={setCredential} />}
      {modal?.kind === "edit" && (
        <MemberFormDialog role={role} member={modal.member} onClose={closeModal} onCreated={setCredential} />
      )}
      {modal?.kind === "setPassword" && <SetPasswordDialog member={modal.member} onClose={closeModal} />}
      {modal?.kind === "delete" && (
        <DeleteMembersDialog
          role={role}
          members={modal.members}
          onClose={closeModal}
          onDeleted={() => setSelected(new Set())}
        />
      )}
      {modal?.kind === "bulkReset" && (
        <BulkResetDialog
          members={modal.members}
          onClose={closeModal}
          onDone={(result) => {
            setSelected(new Set());
            setCredentials(result);
          }}
        />
      )}
      {credential && <CredentialDialog credential={credential} org={org} onClose={() => setCredential(null)} />}
    </Card>
  );
}
