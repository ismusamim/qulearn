import "server-only";

import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";

import type { ActionResult } from "@/lib/action-result";
import { type AuthContext, assertNotBlocked, requireAuth } from "@/server/auth";
import { AppError, ValidationError } from "@/server/errors";

function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

function fail(error: unknown): ActionResult<never> {
  // redirect() / notFound() work by throwing; let Next.js handle those.
  unstable_rethrow(error);
  if (error instanceof ValidationError) return { ok: false, error: error.message, fieldErrors: error.fieldErrors };
  if (error instanceof AppError) return { ok: false, error: error.message };
  console.error("[action] unexpected error", error);
  return { ok: false, error: "حدث خطأ غير متوقع، حاول مرة أخرى" };
}

/**
 * The one way a server action talks to a service:
 *   1. authenticate (and refuse blocked accounts),
 *   2. validate the raw input with a Zod schema,
 *   3. run the handler,
 *   4. turn any error into an ActionResult instead of throwing.
 *
 * Authorisation (who may do this) belongs to the service function the handler calls.
 *
 *   export async function createPlace(input: unknown) {
 *     return runAction(placeSchema, input, async (data, auth) => {
 *       const place = await placesService.create(auth, data);
 *       revalidatePath("/halaqat");
 *       return place;
 *     });
 *   }
 */
export async function runAction<S extends z.ZodType, R>(
  schema: S,
  input: unknown,
  handler: (data: z.output<S>, auth: AuthContext) => Promise<R>,
  options: { allowBlocked?: boolean } = {},
): Promise<ActionResult<R>> {
  try {
    const auth = await requireAuth();
    if (!options.allowBlocked) assertNotBlocked(auth);
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors = toFieldErrors(parsed.error);
      const first = parsed.error.issues[0]?.message;
      return { ok: false, error: first ?? "البيانات المدخلة غير صحيحة", fieldErrors };
    }
    return { ok: true, data: await handler(parsed.data, auth) };
  } catch (error) {
    return fail(error);
  }
}

/** Same as runAction for actions that take no input. */
export async function runSimpleAction<R>(
  handler: (auth: AuthContext) => Promise<R>,
  options: { allowBlocked?: boolean } = {},
): Promise<ActionResult<R>> {
  try {
    const auth = await requireAuth();
    if (!options.allowBlocked) assertNotBlocked(auth);
    return { ok: true, data: await handler(auth) };
  } catch (error) {
    return fail(error);
  }
}

/** For the few actions that run before login (e.g. the login form itself). */
export async function runPublicAction<S extends z.ZodType, R>(
  schema: S,
  input: unknown,
  handler: (data: z.output<S>) => Promise<R>,
): Promise<ActionResult<R>> {
  try {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "البيانات المدخلة غير صحيحة",
        fieldErrors: toFieldErrors(parsed.error),
      };
    }
    return { ok: true, data: await handler(parsed.data) };
  } catch (error) {
    return fail(error);
  }
}
