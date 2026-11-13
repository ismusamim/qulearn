"use client";

import { type ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

/**
 * Confirmation for steps that touch many accounts at once: the administrator
 * types their own password, which the server verifies. Mounted only while open.
 */
export function PasswordConfirmDialog({
  title,
  children,
  confirmLabel,
  destructive = false,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  title: string;
  /** Explains what is about to happen. */
  children: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  pending: boolean;
  /** Server-side error (e.g. wrong password). */
  error: string | null;
  onConfirm: (password: string) => void;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const message = touched && !password ? "اكتب كلمة مرورك للتأكيد" : error;

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            if (password) onConfirm(password);
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">{children}</div>
          <Field data-invalid={!!message}>
            <FieldLabel htmlFor="confirm-own-password">كلمة مرورك للتأكيد</FieldLabel>
            <Input
              id="confirm-own-password"
              type="password"
              dir="ltr"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!message}
            />
            {message && <FieldError>{message}</FieldError>}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              إلغاء
            </Button>
            <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={pending}>
              {pending && <Spinner />}
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
