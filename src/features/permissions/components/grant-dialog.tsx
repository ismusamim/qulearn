"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAction } from "@/hooks/use-action";
import { normalizeArabic } from "@/lib/arabic";
import { PERMISSIONS, type PermissionKey } from "@/lib/permissions";

import { setMemberPermissionsAction, setRolePermissionsAction } from "../actions";
import { GRANT_ROLES, GRANT_ROLE_LABELS, GRANT_ROLE_PLURALS, type GrantRole, isGrantRole, memberAllows, roleAllows } from "../matrix";
import type { PermissionsOverview } from "../service";

export type GrantTarget = { kind: "role"; role: GrantRole } | { kind: "person"; memberId: string | null };

/** «إضافة صلاحية»: for a whole role, or for one person (whose own setting then wins over the role's). */
export function GrantDialog({
  overview,
  open,
  onOpenChange,
  initial,
}: {
  overview: PermissionsOverview;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the dialog opens on, e.g. a given person for the «تعديل» button of an override. */
  initial: GrantTarget;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* Mounted only while open, so every opening starts from a clean state. */}
        {open && <GrantForm overview={overview} initial={initial} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function GrantForm({ overview, initial, onDone }: { overview: PermissionsOverview; initial: GrantTarget; onDone: () => void }) {
  const [target, setTargetState] = useState<GrantTarget>(initial);
  const [query, setQuery] = useState("");
  // Boxes the admin changed; everything else shows the target's current state.
  const [edits, setEdits] = useState<Partial<Record<PermissionKey, boolean>>>({});

  const setTarget = (next: GrantTarget) => {
    setTargetState(next);
    setEdits({});
  };

  const options = { successMessage: "حُفظت الصلاحيات", onSuccess: onDone };
  const saveRole = useAction(setRolePermissionsAction, options);
  const saveMember = useAction(setMemberPermissionsAction, options);
  const pending = saveRole.pending || saveMember.pending;

  const person = target.kind === "person" ? (overview.staff.find((s) => s.id === target.memberId) ?? null) : null;
  const own = person ? (overview.overrides.find((o) => o.id === person.id)?.permissions ?? []) : [];
  const current = (key: PermissionKey): boolean =>
    target.kind === "role"
      ? roleAllows(overview.roleSettings, target.role, key)
      : person
        ? memberAllows(overview.roleSettings, person.role, own, key)
        : false;
  const checked = (key: PermissionKey) => edits[key] ?? current(key);

  const q = normalizeArabic(query);
  const candidates = q ? overview.staff.filter((s) => normalizeArabic(s.name).includes(q)).slice(0, 8) : [];
  const ready = target.kind === "role" || !!person;

  function save() {
    if (target.kind === "role") {
      const changed = PERMISSIONS.filter((p) => edits[p.key] !== undefined && edits[p.key] !== current(p.key));
      if (changed.length === 0) return onDone();
      saveRole.execute({ role: target.role, permissions: changed.map((p) => ({ permission: p.key, allowed: checked(p.key) })) });
    } else if (person) {
      saveMember.execute({
        memberId: person.id,
        permissions: PERMISSIONS.map((p) => ({ permission: p.key, allowed: checked(p.key) })),
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>إضافة صلاحية</DialogTitle>
        <DialogDescription>صلاحية الشخص تتقدّم على صلاحية فئته، منحًا أو سحبًا.</DialogDescription>
      </DialogHeader>

      <ToggleGroup
        type="single"
        variant="outline"
        value={target.kind}
        onValueChange={(kind) => {
          if (kind === "role") setTarget({ kind: "role", role: "TEACHER" });
          if (kind === "person") setTarget({ kind: "person", memberId: null });
          setQuery("");
        }}
      >
        <ToggleGroupItem value="role">لفئة كاملة</ToggleGroupItem>
        <ToggleGroupItem value="person">لشخص بعينه</ToggleGroupItem>
      </ToggleGroup>

      {target.kind === "role" ? (
        <Field>
          <FieldLabel htmlFor="grant-role">الفئة</FieldLabel>
          <Select value={target.role} onValueChange={(role) => isGrantRole(role) && setTarget({ kind: "role", role })}>
            <SelectTrigger id="grant-role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GRANT_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {GRANT_ROLE_PLURALS[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : person ? (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">{person.name}</span>
          <span className="text-muted-foreground">— {GRANT_ROLE_LABELS[person.role]}</span>
          <Button type="button" variant="outline" size="xs" onClick={() => setTarget({ kind: "person", memberId: null })}>
            تغيير
          </Button>
        </p>
      ) : (
        <Field>
          <FieldLabel htmlFor="grant-person">الشخص</FieldLabel>
          <Input
            id="grant-person"
            type="search"
            autoComplete="off"
            autoFocus
            placeholder="اكتب اسم معلم أو مشرف أو محاسب"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {candidates.length > 0 && (
            <ul className="flex flex-col overflow-hidden rounded-lg border">
              {candidates.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-start text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                    onClick={() => {
                      setTarget({ kind: "person", memberId: s.id });
                      setQuery("");
                    }}
                  >
                    {s.name} <span className="text-xs text-muted-foreground">— {GRANT_ROLE_LABELS[s.role]}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {q && candidates.length === 0 && <p className="text-sm text-muted-foreground">لا يوجد اسم مطابق.</p>}
        </Field>
      )}

      {ready && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">الصلاحيات</p>
          {PERMISSIONS.map((permission) => {
            const id = `grant-${permission.key}`;
            const followsRole = !!person && edits[permission.key] === undefined && !own.some((o) => o.permission === permission.key);
            return (
              <div key={permission.key} className="flex items-start gap-2">
                <Checkbox
                  id={id}
                  className="mt-1"
                  checked={checked(permission.key)}
                  onCheckedChange={(value) => setEdits((current) => ({ ...current, [permission.key]: value === true }))}
                />
                <label htmlFor={id} className="cursor-pointer text-sm leading-snug">
                  <span className="font-semibold">{permission.label}</span>{" "}
                  <span className="text-xs text-muted-foreground">
                    {permission.description}
                    {followsRole && " (حسب فئته)"}
                  </span>
                </label>
              </div>
            );
          })}
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          إلغاء
        </Button>
        <Button type="button" disabled={!ready || pending} onClick={save}>
          {pending && <Spinner />}
          حفظ
        </Button>
      </DialogFooter>
    </div>
  );
}
