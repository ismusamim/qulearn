import type { Role } from "@/lib/constants";

/**
 * Grantable permissions. Admins always hold all of them. For everyone else the
 * answer is: member override → role setting → built-in default for the role.
 * Everything not listed here is fixed by role (see the guards in each service).
 */
export const PERMISSIONS = [
  { key: "students.add", label: "إضافة طالب", description: "استمارة طالب جديد", group: "الحلقات والطلاب", defaults: ["ACCOUNTANT"] },
  { key: "students.status", label: "حالة الطالب", description: "منقطع أو منتظم", group: "الحلقات والطلاب", defaults: ["ACCOUNTANT"] },
  { key: "students.move", label: "نقل طالب", description: "من حلقة إلى أخرى أو من مكان لآخر", group: "الحلقات والطلاب", defaults: ["ACCOUNTANT"] },
  { key: "fees.collect", label: "تحصيل الاشتراكات", description: "تسجيل ما يُدفع وحذف ما سجّله بنفسه", group: "الاشتراكات", defaults: ["ACCOUNTANT"] },
  { key: "fees.amount", label: "قيمة الاشتراك", description: "تحديد فئة الطالب وخصمه ومبلغه وتغييرها", group: "الاشتراكات", defaults: ["ACCOUNTANT"] },
  { key: "notes.send", label: "ملاحظات للإدارة", description: "تظهر في إعلانات المدير أو المشرفين باسم صاحبها", group: "الحسابات والإدارة", defaults: ["ACCOUNTANT"] },
] as const satisfies ReadonlyArray<{
  key: string;
  label: string;
  description: string;
  group: string;
  defaults: readonly Role[];
}>;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const PERMISSION_KEYS: readonly PermissionKey[] = PERMISSIONS.map((p) => p.key);

export function isPermissionKey(value: string): value is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(value);
}

export function permissionDefault(role: Role, key: PermissionKey): boolean {
  const def = PERMISSIONS.find((p) => p.key === key);
  return !!def && (def.defaults as readonly Role[]).includes(role);
}

/**
 * Pure resolution of a member's effective permissions.
 * @param roleSettings   rows of role_permissions for the member's role
 * @param memberSettings rows of member_permissions for the member
 */
export function resolvePermissions(
  role: Role,
  roleSettings: ReadonlyArray<{ permission: string; allowed: boolean }>,
  memberSettings: ReadonlyArray<{ permission: string; allowed: boolean }>,
): Set<PermissionKey> {
  if (role === "ADMIN") return new Set(PERMISSION_KEYS);
  const granted = new Set<PermissionKey>();
  for (const key of PERMISSION_KEYS) {
    const override = memberSettings.find((s) => s.permission === key);
    const roleSetting = roleSettings.find((s) => s.permission === key);
    const allowed = override?.allowed ?? roleSetting?.allowed ?? permissionDefault(role, key);
    if (allowed) granted.add(key);
  }
  return granted;
}
