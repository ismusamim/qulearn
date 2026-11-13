import { z } from "zod";

import { PERMISSION_KEYS, type PermissionKey, isPermissionKey } from "@/lib/permissions";

import { GRANT_ROLES } from "./matrix";

const permissionKey = z.custom<PermissionKey>((value) => typeof value === "string" && isPermissionKey(value), "صلاحية غير معروفة");

const choices = z
  .array(z.object({ permission: permissionKey, allowed: z.boolean() }))
  .min(1, "اختر صلاحية")
  .max(PERMISSION_KEYS.length);

/** Explicit choices (allowed or not) for a whole role. */
export const rolePermissionsSchema = z.object({
  role: z.enum(GRANT_ROLES, "فئة غير صحيحة"),
  permissions: choices,
});

/** The wanted state of each permission for one person. */
export const memberPermissionsSchema = z.object({
  memberId: z.uuid(),
  permissions: choices,
});

export const memberIdSchema = z.object({ memberId: z.uuid() });
