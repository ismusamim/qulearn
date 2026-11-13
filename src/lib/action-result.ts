/**
 * The single shape every server action returns, so the client never has to
 * catch thrown errors or guess what went wrong.
 */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
