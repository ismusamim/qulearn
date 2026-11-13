import { z } from "zod";

export const loginSchema = z.object({
  name: z.string().trim().min(1, "اكتب اسمك"),
  /** Set when the user picked an account from the suggestions. */
  memberId: z.uuid().optional(),
  password: z.string().min(1, "اكتب كلمة المرور"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const nameSearchSchema = z.object({ query: z.string().max(100) });

export const switchAccountSchema = z.object({
  memberId: z.uuid(),
  password: z.string().min(1, "اكتب كلمة المرور"),
});
export type SwitchAccountInput = z.infer<typeof switchAccountSchema>;
