import { PERMISSIONS, type PermissionKey, permissionDefault } from "@/lib/permissions";

/** Roles a grantable permission can be given to. Admins hold everything; students nothing. */
export const GRANT_ROLES = ["TEACHER", "SUPERVISOR", "ACCOUNTANT"] as const;
export type GrantRole = (typeof GRANT_ROLES)[number];

export function isGrantRole(value: string): value is GrantRole {
  return (GRANT_ROLES as readonly string[]).includes(value);
}

export const GRANT_ROLE_LABELS: Record<GrantRole, string> = { TEACHER: "معلم", SUPERVISOR: "مشرف", ACCOUNTANT: "محاسب" };
export const GRANT_ROLE_PLURALS: Record<GrantRole, string> = {
  TEACHER: "المعلمون",
  SUPERVISOR: "المشرفون",
  ACCOUNTANT: "المحاسبون",
};

/**
 * Tasks fixed by role (enforced by the guards of each service; not editable
 * here). `roles` are the roles that always own the task; an empty list means
 * admin only.
 */
export const FIXED_TASKS: ReadonlyArray<{ group: string; label: string; roles: readonly GrantRole[] }> = [
  { group: "الحلقات والطلاب", label: "تسجيل حضور طلاب حلقاته", roles: ["TEACHER", "SUPERVISOR"] },
  { group: "الحلقات والطلاب", label: "تسجيل التسميع وسجل الطالب", roles: ["TEACHER", "SUPERVISOR"] },
  { group: "الحلقات والطلاب", label: "تعديل استمارة الطالب كاملة وحذفه", roles: [] },
  { group: "الحلقات والطلاب", label: "الأماكن والحلقات (إضافة وتعديل وحذف)", roles: [] },
  { group: "المعلمون والعاملون", label: "تعديل ملفه الشخصي والفني", roles: ["TEACHER"] },
  { group: "المعلمون والعاملون", label: "تسجيل غياب المعلمين", roles: ["SUPERVISOR"] },
  { group: "المعلمون والعاملون", label: "بيانات المعلمين الإدارية", roles: [] },
  { group: "المعلمون والعاملون", label: "المرتبات وكشوفها", roles: [] },
  { group: "الحسابات والإدارة", label: "الأعضاء وحسابات الدخول وكلمات المرور", roles: [] },
  { group: "الحسابات والإدارة", label: "الفئات والخصومات", roles: [] },
  { group: "الحسابات والإدارة", label: "نشر الإعلانات", roles: [] },
  { group: "الحسابات والإدارة", label: "الاستيراد والبيانات المعلّقة", roles: [] },
  { group: "الحسابات والإدارة", label: "الصلاحيات والإعدادات والنسخ الاحتياطي", roles: [] },
];

/** Group names in display order: those of the fixed tasks first, then any group only grantable permissions use. */
export const TASK_GROUPS: readonly string[] = [
  ...new Set([...FIXED_TASKS.map((t) => t.group), ...PERMISSIONS.map((p) => p.group)]),
];

export interface RoleSetting {
  role: GrantRole;
  permission: PermissionKey;
  allowed: boolean;
}

export interface PermissionChoice {
  permission: PermissionKey;
  allowed: boolean;
}

/** The admin's explicit choice for the role, if any. */
export function explicitRoleSetting(settings: readonly RoleSetting[], role: GrantRole, key: PermissionKey): boolean | undefined {
  return settings.find((s) => s.role === role && s.permission === key)?.allowed;
}

/** What the whole role gets: the admin's choice if there is one, else the built-in default. */
export function roleAllows(settings: readonly RoleSetting[], role: GrantRole, key: PermissionKey): boolean {
  return explicitRoleSetting(settings, role, key) ?? permissionDefault(role, key);
}

/** What one person gets: their own override wins over their role. */
export function memberAllows(
  settings: readonly RoleSetting[],
  role: GrantRole,
  overrides: readonly PermissionChoice[],
  key: PermissionKey,
): boolean {
  return overrides.find((o) => o.permission === key)?.allowed ?? roleAllows(settings, role, key);
}

/**
 * Turns the ticked boxes of the «person» form into override rows. Only what
 * differs from the person's role is kept as an override; the rest is removed,
 * so those permissions keep following the role if it changes later.
 */
export function planMemberOverrides(
  settings: readonly RoleSetting[],
  role: GrantRole,
  desired: readonly PermissionChoice[],
): { set: PermissionChoice[]; remove: PermissionKey[] } {
  const set: PermissionChoice[] = [];
  const remove: PermissionKey[] = [];
  for (const choice of desired) {
    if (choice.allowed === roleAllows(settings, role, choice.permission)) remove.push(choice.permission);
    else set.push(choice);
  }
  return { set, remove };
}
