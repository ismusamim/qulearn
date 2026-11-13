import { z } from "zod";

const role = z.enum(["ADMIN", "SUPERVISOR", "TEACHER", "STUDENT", "ACCOUNTANT"]);

/** Name and phone — the fields of the create/edit dialog. */
export const memberFormSchema = z.object({
  name: z.string().trim().min(1, "اكتب الاسم").max(120, "الاسم طويل جدًا"),
  phone: z
    .string()
    .trim()
    .max(25, "رقم الجوال طويل جدًا")
    .regex(/^[\d٠-٩۰-۹+\s()-]*$/, "رقم الجوال غير صحيح")
    .default(""),
});
export type MemberFormInput = z.input<typeof memberFormSchema>;

export const createMemberSchema = memberFormSchema.extend({ role });
export const updateMemberSchema = memberFormSchema.extend({ id: z.uuid() });

export const memberIdSchema = z.object({ id: z.uuid() });

/** bcrypt ignores everything after 72 bytes, so longer passwords are refused. */
export const passwordFormSchema = z.object({
  password: z.string().min(4, "كلمة المرور 4 أحرف على الأقل").max(72, "كلمة المرور طويلة جدًا"),
});
export type PasswordFormInput = z.input<typeof passwordFormSchema>;

export const setPasswordSchema = passwordFormSchema.extend({ id: z.uuid() });

/** Most accounts one request may reset: each one costs a bcrypt hash. */
export const BULK_RESET_LIMIT = 200;

/** Bulk steps are confirmed with the administrator's own password. */
const confirmPassword = z.string().min(1, "اكتب كلمة مرورك للتأكيد");

export const bulkResetSchema = z.object({
  ids: z
    .array(z.uuid())
    .min(1, "حدّد عضوًا واحدًا على الأقل")
    .max(BULK_RESET_LIMIT, `حدّد ${BULK_RESET_LIMIT} عضو على الأكثر في المرة الواحدة`),
  confirmPassword,
});

export const deleteMembersSchema = z.object({
  ids: z.array(z.uuid()).min(1, "حدّد عضوًا واحدًا على الأقل").max(1000),
  confirmPassword,
});
