import { normalizePhone } from "@/lib/arabic";
import type { Role } from "@/lib/constants";

/** URL value of the role selector (`/members?role=students`), in display order. */
export const ROLE_SLUGS = {
  teachers: "TEACHER",
  students: "STUDENT",
  supervisors: "SUPERVISOR",
  accountants: "ACCOUNTANT",
  admins: "ADMIN",
} as const satisfies Record<string, Role>;

export type RoleSlug = keyof typeof ROLE_SLUGS;

export const DEFAULT_ROLE_SLUG: RoleSlug = "teachers";

export function roleFromSlug(slug: string | null | undefined): Role {
  // The slug comes from the URL: only own keys count («constructor» is not a role).
  return slug && Object.hasOwn(ROLE_SLUGS, slug) ? ROLE_SLUGS[slug as RoleSlug] : ROLE_SLUGS[DEFAULT_ROLE_SLUG];
}

export function slugFromRole(role: Role): RoleSlug {
  return (Object.keys(ROLE_SLUGS) as RoleSlug[]).find((slug) => ROLE_SLUGS[slug] === role) ?? DEFAULT_ROLE_SLUG;
}

/**
 * WhatsApp wants the number in international form. Members are in Egypt:
 * a local mobile «01xxxxxxxxx» gets the country code 2 in front, a number
 * already written as «20…» is kept, anything else is unusable (empty string).
 * The first non-empty candidate decides — a later one is not tried.
 */
export function whatsappNumber(...candidates: Array<string | null | undefined>): string {
  const first = candidates.find((c) => normalizePhone(c) !== "");
  const digits = normalizePhone(first);
  if (/^01\d{9}$/.test(digits)) return "2" + digits;
  if (/^20\d{10}$/.test(digits)) return digits;
  return "";
}

export interface LoginMessageInput {
  org: string;
  url: string;
  name: string;
  password: string;
}

/** The ready-made message handed to a member with their login details. */
export function loginMessage({ org, url, name, password }: LoginMessageInput): string {
  return [
    "السلام عليكم ورحمة الله",
    `بيانات دخولك إلى «${org}»:`,
    `الرابط: ${url}`,
    `الاسم: ${name}`,
    `كلمة المرور: ${password}`,
    "في صفحة الدخول اكتب اسمك ثم كلمة المرور.",
    "لا تشارك كلمة المرور مع أحد.",
  ].join("\n");
}

/** With no number WhatsApp opens its contact picker instead. */
export function whatsappLink(number: string, text: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
