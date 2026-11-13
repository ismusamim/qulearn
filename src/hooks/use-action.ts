"use client";

import { useCallback, useTransition } from "react";

import { toast } from "sonner";

import type { ActionResult } from "@/lib/action-result";

interface UseActionOptions<T> {
  /** Toast shown when the action succeeds. */
  successMessage?: string;
  onSuccess?: (data: T) => void;
  /** Called with the error message; when omitted the error is shown as a toast. */
  onError?: (error: string, fieldErrors?: Record<string, string[]>) => void;
}

/**
 * Runs a server action from a client component: tracks the pending state and
 * reports the outcome, so components never repeat that plumbing.
 *
 *   const { execute, pending } = useAction(createPlaceAction, {
 *     successMessage: "تم الحفظ",
 *     onSuccess: () => setOpen(false),
 *   });
 *   <form onSubmit={(e) => { e.preventDefault(); execute(values); }}>
 */
export function useAction<I, T>(action: (input: I) => Promise<ActionResult<T>>, options: UseActionOptions<T> = {}) {
  const [pending, startTransition] = useTransition();
  const { successMessage, onSuccess, onError } = options;

  const execute = useCallback(
    (input: I) => {
      startTransition(async () => {
        const result = await action(input);
        if (result.ok) {
          if (successMessage) toast.success(successMessage);
          onSuccess?.(result.data);
        } else if (onError) {
          onError(result.error, result.fieldErrors);
        } else {
          toast.error(result.error);
        }
      });
    },
    [action, successMessage, onSuccess, onError],
  );

  return { execute, pending };
}
