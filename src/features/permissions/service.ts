import "server-only";

import type { z } from "zod";

import { isPermissionKey } from "@/lib/permissions";
import { type AuthContext, assertRole } from "@/server/auth";
import { db } from "@/server/db";
import { NotFoundError, ValidationError } from "@/server/errors";

import { GRANT_ROLES, type GrantRole, type PermissionChoice, type RoleSetting, isGrantRole, planMemberOverrides } from "./matrix";
import type { memberPermissionsSchema, rolePermissionsSchema } from "./schemas";

export interface StaffOption {
  id: string;
  name: string;
  role: GrantRole;
}

export interface MemberOverrideDTO extends StaffOption {
  /** The person's own settings; each one wins over their role's. */
  permissions: PermissionChoice[];
}

export interface PermissionsOverview {
  /** Only the admin's explicit choices; anything missing follows the built-in default. */
  roleSettings: RoleSetting[];
  overrides: MemberOverrideDTO[];
  /** Everyone an override can be given to (teachers, supervisors, accountants). */
  staff: StaffOption[];
}

async function loadRoleSettings(): Promise<RoleSetting[]> {
  const rows = await db.rolePermission.findMany({ where: { role: { in: [...GRANT_ROLES] } } });
  const out: RoleSetting[] = [];
  for (const row of rows) {
    // Rows of permissions that no longer exist are ignored.
    if (isGrantRole(row.role) && isPermissionKey(row.permission)) {
      out.push({ role: row.role, permission: row.permission, allowed: row.allowed });
    }
  }
  return out;
}

/** Managing permissions is fixed to admins. */
export async function getPermissionsOverview(auth: AuthContext): Promise<PermissionsOverview> {
  assertRole(auth, "ADMIN");
  const [roleSettings, members, memberRows] = await Promise.all([
    loadRoleSettings(),
    db.member.findMany({
      where: { role: { in: [...GRANT_ROLES] } },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
    db.memberPermission.findMany({ where: { member: { role: { in: [...GRANT_ROLES] } } } }),
  ]);

  const staff: StaffOption[] = [];
  for (const m of members) if (isGrantRole(m.role)) staff.push({ id: m.id, name: m.name, role: m.role });

  const byMember = new Map<string, PermissionChoice[]>();
  for (const row of memberRows) {
    if (!isPermissionKey(row.permission)) continue;
    const list = byMember.get(row.memberId) ?? [];
    list.push({ permission: row.permission, allowed: row.allowed });
    byMember.set(row.memberId, list);
  }
  const overrides = staff.filter((s) => byMember.has(s.id)).map((s) => ({ ...s, permissions: byMember.get(s.id) ?? [] }));

  return { roleSettings, overrides, staff };
}

/**
 * Stores the choice explicitly (allowed or not) rather than deleting the row,
 * so a permission a role holds by default can be withdrawn from it.
 */
export async function setRolePermissions(auth: AuthContext, input: z.output<typeof rolePermissionsSchema>): Promise<void> {
  assertRole(auth, "ADMIN");
  await db.$transaction(
    input.permissions.map(({ permission, allowed }) =>
      db.rolePermission.upsert({
        where: { role_permission: { role: input.role, permission } },
        create: { role: input.role, permission, allowed },
        update: { allowed },
      }),
    ),
  );
}

/** Sets what one person should hold; see planMemberOverrides for what is actually stored. */
export async function setMemberPermissions(auth: AuthContext, input: z.output<typeof memberPermissionsSchema>): Promise<void> {
  assertRole(auth, "ADMIN");
  const member = await db.member.findUnique({ where: { id: input.memberId }, select: { id: true, role: true } });
  if (!member) throw new NotFoundError("العضو غير موجود");
  // Admins hold everything and students nothing: an override would mean nothing for them.
  if (!isGrantRole(member.role)) throw new ValidationError("الصلاحيات الخاصة للمعلمين والمشرفين والمحاسبين فقط");

  const plan = planMemberOverrides(await loadRoleSettings(), member.role, input.permissions);
  await db.$transaction([
    db.memberPermission.deleteMany({ where: { memberId: member.id, permission: { in: plan.remove } } }),
    ...plan.set.map(({ permission, allowed }) =>
      db.memberPermission.upsert({
        where: { memberId_permission: { memberId: member.id, permission } },
        create: { memberId: member.id, permission, allowed },
        update: { allowed },
      }),
    ),
  ]);
}

/** «إلغاء الاستثناء»: the person goes back to following their role. */
export async function clearMemberOverrides(auth: AuthContext, memberId: string): Promise<void> {
  assertRole(auth, "ADMIN");
  await db.memberPermission.deleteMany({ where: { memberId } });
}

/** Every role goes back to its built-in permissions. Personal overrides are kept. */
export async function resetRolePermissions(auth: AuthContext): Promise<void> {
  assertRole(auth, "ADMIN");
  await db.rolePermission.deleteMany({});
}
