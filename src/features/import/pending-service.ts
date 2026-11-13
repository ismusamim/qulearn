import "server-only";

import { randomUUID } from "node:crypto";

import type { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { toISODate } from "@/lib/dates";
import { type AuthContext, assertRole } from "@/server/auth";
import { db, type Tx } from "@/server/db";
import { listCustomFields } from "@/server/directory";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";

import { applyField, emptyPatch } from "./apply-field";
import { type FieldType, fieldTargets, headerKey, type ImportKind, KIND_ROLE, TARGET_HALAQA, TARGET_PIN } from "./fields";
import type { approvePendingSchema, savePendingSchema, updateCustomFieldSchema } from "./schemas";
import { DESTINATION_NEW } from "./schemas";
import { applyPatch, LONG_TX, type PendingValue } from "./service";

/**
 * «بيانات معلّقة» (imported columns awaiting a decision) and the custom
 * fields they turn into. Admin only.
 */

// ───────────── Pending columns ─────────────

export interface PendingColumnDTO {
  id: string;
  kind: ImportKind;
  header: string;
  type: FieldType;
  date: string;
  /** Only values whose member still exists. */
  values: PendingValue[];
}

const storedValues = (raw: unknown): PendingValue[] =>
  (Array.isArray(raw) ? raw : []).flatMap((x) => {
    const o = (x ?? {}) as Record<string, unknown>;
    return typeof o.memberId === "string" && typeof o.value === "string"
      ? [{ memberId: o.memberId, name: typeof o.name === "string" ? o.name : "", value: o.value }]
      : [];
  });

export async function countPendingColumns(auth: AuthContext): Promise<number> {
  assertRole(auth, "ADMIN");
  return db.pendingColumn.count();
}

export async function listPendingColumns(auth: AuthContext): Promise<PendingColumnDTO[]> {
  assertRole(auth, "ADMIN");
  const rows = await db.pendingColumn.findMany({ orderBy: [{ date: "desc" }, { header: "asc" }] });
  const parsed = rows.map((r) => ({ row: r, values: storedValues(r.values) }));
  const ids = [...new Set(parsed.flatMap((p) => p.values.map((v) => v.memberId)))];
  const members = await db.member.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, role: true } });
  const byId = new Map(members.map((m) => [m.id, m]));
  return parsed.map(({ row, values }) => ({
    id: row.id,
    kind: row.kind,
    header: row.header,
    type: row.type,
    date: toISODate(row.date),
    values: values.flatMap((v) => {
      const m = byId.get(v.memberId);
      return m && m.role === KIND_ROLE[row.kind] ? [{ ...v, name: m.name }] : [];
    }),
  }));
}

/** The stored values with the admin's edits applied; values of unknown members are ignored. */
async function editedValues(client: Tx | typeof db, id: string, edits: ReadonlyArray<{ memberId: string; value: string }>) {
  const column = await client.pendingColumn.findUnique({ where: { id } });
  if (!column) throw new NotFoundError("العمود غير موجود");
  const edit = new Map(edits.map((e) => [e.memberId, e.value]));
  const values = storedValues(column.values).map((v) => (edit.has(v.memberId) ? { ...v, value: edit.get(v.memberId)! } : v));
  return { column, values };
}

/** Renames the column and saves edited values without approving it yet. */
export async function savePendingColumn(auth: AuthContext, input: z.output<typeof savePendingSchema>): Promise<void> {
  assertRole(auth, "ADMIN");
  const { values } = await editedValues(db, input.id, input.values);
  await db.pendingColumn.update({
    where: { id: input.id },
    data: { header: input.header, type: input.type, values: values as unknown as Prisma.InputJsonValue },
  });
}

export async function deletePendingColumn(auth: AuthContext, id: string): Promise<void> {
  assertRole(auth, "ADMIN");
  const { count } = await db.pendingColumn.deleteMany({ where: { id } });
  if (!count) throw new NotFoundError("العمود غير موجود");
}

async function assertLabelFree(kind: ImportKind, label: string, exceptKey?: string): Promise<void> {
  const fields = (await listCustomFields(kind)).filter((f) => f.key !== exceptKey);
  const key = headerKey(label);
  if (key === headerKey("الاسم") || fieldTargets(kind, fields).some((t) => headerKey(t.label) === key)) {
    throw new ConflictError("يوجد حقل بهذا الاسم؛ اختر «ربط بالحقل الموجود» أو غيّر الاسم");
  }
}

/**
 * «اعتماد»: the column becomes a new custom field, or its values are copied
 * into an existing field. Empty values and members that no longer exist are
 * left out. Returns how many values were stored.
 */
export async function approvePendingColumn(auth: AuthContext, input: z.output<typeof approvePendingSchema>): Promise<{ applied: number }> {
  assertRole(auth, "ADMIN");
  return db.$transaction(async (tx) => {
    const { column, values } = await editedValues(tx, input.id, input.values);
    const kind = column.kind;

    let target = input.destination;
    if (target === DESTINATION_NEW) {
      await assertLabelFree(kind, input.header);
      const key = `f_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
      await tx.customField.create({ data: { kind, key, label: input.header, type: input.type } });
      target = `extra:${key}`;
    } else {
      const allowed = fieldTargets(kind, await listCustomFields(kind)).filter((t) => t.id !== TARGET_HALAQA && t.id !== TARGET_PIN);
      if (!allowed.some((t) => t.id === target)) throw new ValidationError("الحقل المختار غير موجود");
    }

    const members = await tx.member.findMany({
      where: { id: { in: values.map((v) => v.memberId) }, role: KIND_ROLE[kind] },
      select: { id: true },
    });
    const alive = new Set(members.map((m) => m.id));
    let applied = 0;
    const rejected: string[] = [];
    for (const v of values) {
      if (!alive.has(v.memberId) || !v.value.trim()) continue;
      const patch = emptyPatch();
      if (!applyField(patch, target, v.value)) {
        rejected.push(v.value);
        continue;
      }
      await applyPatch(tx, kind, v.memberId, patch);
      applied++;
    }
    if (rejected.length) {
      throw new ValidationError(`${rejected.length} قيمة لا تصلح لهذا الحقل (مثل «${rejected[0].slice(0, 30)}»). عدّلها أو امسحها ثم اعتمد.`);
    }
    await tx.pendingColumn.delete({ where: { id: input.id } });
    return { applied };
  }, LONG_TX);
}

// ───────────── Custom fields ─────────────

export interface CustomFieldDTO {
  kind: ImportKind;
  key: string;
  label: string;
  type: FieldType;
  /** Members that have a value for this field. */
  usedBy: number;
}

export async function listCustomFieldDefs(auth: AuthContext): Promise<CustomFieldDTO[]> {
  assertRole(auth, "ADMIN");
  const fields = await db.customField.findMany({ orderBy: [{ kind: "asc" }, { label: "asc" }] });
  const out: CustomFieldDTO[] = [];
  for (const f of fields) {
    const role: string = KIND_ROLE[f.kind];
    const [{ n }] = await db.$queryRaw<[{ n: bigint }]>`
      SELECT count(*) AS n FROM members WHERE role::text = ${role} AND jsonb_exists(extra, ${f.key}::text)`;
    out.push({ kind: f.kind, key: f.key, label: f.label, type: f.type, usedBy: Number(n) });
  }
  return out;
}

export async function updateCustomField(auth: AuthContext, input: z.output<typeof updateCustomFieldSchema>): Promise<void> {
  assertRole(auth, "ADMIN");
  const where = { kind_key: { kind: input.kind, key: input.key } };
  const field = await db.customField.findUnique({ where });
  if (!field) throw new NotFoundError("الحقل غير موجود");
  if (headerKey(field.label) !== headerKey(input.label)) await assertLabelFree(input.kind, input.label, input.key);
  await db.customField.update({ where, data: { label: input.label, type: input.type } });
}

/** Deletes the definition and every member's value for it. */
export async function deleteCustomField(auth: AuthContext, kind: ImportKind, key: string): Promise<void> {
  assertRole(auth, "ADMIN");
  const role: string = KIND_ROLE[kind];
  await db.$transaction(async (tx) => {
    const { count } = await tx.customField.deleteMany({ where: { kind, key } });
    if (!count) throw new NotFoundError("الحقل غير موجود");
    await tx.$executeRaw`UPDATE members SET extra = extra - ${key}::text WHERE role::text = ${role} AND jsonb_exists(extra, ${key}::text)`;
  });
}
