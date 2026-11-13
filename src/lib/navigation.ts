import type { Role } from "@/lib/constants";
import type { PermissionKey } from "@/lib/permissions";

/**
 * Every section of the app, in sidebar order. A user sees an item when their
 * role is listed OR they hold one of its permissions. This list only drives
 * the menu; each page and service still enforces its own access.
 */
export interface NavItem {
  href: string;
  /** May differ per role (the same page is «طلابي» for a teacher, «الطلاب» for a supervisor). */
  label: string | Partial<Record<Role, string>> & { default: string };
  /** Key into the icon map in src/components/layout/nav-icons.tsx. */
  icon: string;
  roles: readonly Role[];
  permissions?: readonly PermissionKey[];
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "الرئيسية", icon: "home", roles: ["ADMIN"] },
  { href: "/progress", label: "تقدمي", icon: "progress", roles: ["STUDENT"] },
  { href: "/history", label: "السجل", icon: "history", roles: ["STUDENT"] },
  { href: "/attendance", label: "الحضور", icon: "attendance", roles: ["TEACHER", "SUPERVISOR", "ADMIN"] },
  { href: "/my-students", label: { default: "طلابي", SUPERVISOR: "الطلاب", ADMIN: "التسميع" }, icon: "recitation", roles: ["TEACHER", "SUPERVISOR", "ADMIN"] },
  { href: "/exams", label: "الاختبارات", icon: "exams", roles: ["TEACHER", "SUPERVISOR", "ADMIN"] },
  { href: "/collections", label: "التحصيل", icon: "collect", roles: ["TEACHER"] },
  { href: "/profile", label: "ملفي", icon: "profile", roles: ["TEACHER"] },
  { href: "/members", label: "الأعضاء", icon: "members", roles: ["ADMIN"] },
  { href: "/teachers", label: "المعلمون", icon: "teachers", roles: ["ADMIN"] },
  { href: "/halaqat", label: "الأماكن والحلقات", icon: "halaqat", roles: ["ADMIN"] },
  { href: "/students", label: "الطلاب", icon: "students", roles: ["ADMIN", "ACCOUNTANT"], permissions: ["students.add", "students.status", "students.move", "fees.amount"] },
  { href: "/absences", label: "غياب المعلمين", icon: "absence", roles: ["ADMIN", "SUPERVISOR"] },
  { href: "/fees", label: "الاشتراكات", icon: "fees", roles: ["ADMIN"], permissions: ["fees.collect", "fees.amount"] },
  { href: "/collections/review", label: "تحصيل المعلمين", icon: "collect", roles: ["ADMIN"], permissions: ["fees.collect"] },
  { href: "/payroll", label: "المرتبات", icon: "payroll", roles: ["ADMIN"] },
  { href: "/notes", label: "ملاحظات للإدارة", icon: "notes", roles: [], permissions: ["notes.send"] },
  { href: "/news", label: "الإعلانات", icon: "news", roles: ["ADMIN", "SUPERVISOR", "TEACHER", "STUDENT", "ACCOUNTANT"] },
  { href: "/import", label: "الاستيراد والبيانات", icon: "import", roles: ["ADMIN"] },
  { href: "/permissions", label: "الصلاحيات", icon: "permissions", roles: ["ADMIN"] },
  { href: "/settings", label: "الإعدادات", icon: "settings", roles: ["ADMIN"] },
];

export interface ResolvedNavItem {
  href: string;
  label: string;
  icon: string;
}

/** The menu for one user. Admins hold every permission but only see items that list ADMIN. */
export function navFor(role: Role, permissions: ReadonlySet<PermissionKey>): ResolvedNavItem[] {
  return NAV_ITEMS.filter(
    (item) =>
      item.roles.includes(role) ||
      (role !== "ADMIN" && (item.permissions ?? []).some((p) => permissions.has(p))),
  ).map((item) => ({
    href: item.href,
    icon: item.icon,
    label: typeof item.label === "string" ? item.label : (item.label[role] ?? item.label.default),
  }));
}

/** Where a user lands after login. */
export function homeFor(role: Role, permissions: ReadonlySet<PermissionKey>): string {
  return navFor(role, permissions)[0]?.href ?? "/news";
}
