"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ROLE_LABELS } from "@/lib/constants";

import { loginAction, searchLoginNamesAction } from "../actions";
import type { LoginNameMatch } from "../service";

/**
 * One login for everyone: type a few letters of your name, pick it from the
 * list (which shows the account type), then enter the password. Administrators
 * are never suggested; they type their full name.
 */
export function LoginForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [matches, setMatches] = useState<LoginNameMatch[]>([]);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<LoginNameMatch | null>(null);
  const [memberId, setMemberId] = useState<string | undefined>();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const passwordRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);

  // Debounced suggestions; stale responses are dropped.
  useEffect(() => {
    if (picked || name.trim().length < 2) return;
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      const result = await searchLoginNamesAction({ query: name });
      if (id !== requestId.current) return;
      setMatches(result.ok ? result.data : []);
      setOpen(true);
    }, 200);
    return () => clearTimeout(timer);
  }, [name, picked]);

  function onNameChange(value: string) {
    setName(value);
    setPicked(null);
    setMemberId(undefined);
    setError(null);
    if (value.trim().length < 2) {
      setMatches([]);
      setOpen(false);
    }
  }

  function pick(match: LoginNameMatch) {
    setPicked(match);
    setName(match.name);
    setMemberId(match.accounts[0]?.memberId);
    setOpen(false);
    setError(null);
    passwordRef.current?.focus();
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await loginAction({ name, memberId, password });
      if (!result.ok) {
        setError(result.error);
        setPassword("");
        return;
      }
      router.replace(result.data.redirectTo);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field>
        <FieldLabel htmlFor="login-name">الاسم</FieldLabel>
        <div className="relative">
          <Input
            id="login-name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            onFocus={() => matches.length > 0 && !picked && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="اكتب أول حروف اسمك"
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls="login-name-results"
            aria-autocomplete="list"
          />
          {open && matches.length > 0 && (
            <ul
              id="login-name-results"
              role="listbox"
              className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-md border bg-popover p-1 shadow-md"
            >
              {matches.map((match) => (
                <li key={match.name} role="option" aria-selected={false}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-start text-sm hover:bg-accent"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(match)}
                  >
                    <span className="font-medium">{match.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {match.accounts.map((a) => ROLE_LABELS[a.role]).join(" / ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Field>

      {picked && picked.accounts.length > 1 && (
        <Field>
          <FieldLabel>الدخول بصفة</FieldLabel>
          <ToggleGroup
            type="single"
            variant="outline"
            value={memberId}
            onValueChange={(value) => value && setMemberId(value)}
            className="w-full"
          >
            {picked.accounts.map((account) => (
              <ToggleGroupItem key={account.memberId} value={account.memberId} className="flex-1">
                {ROLE_LABELS[account.role]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
      )}

      <Field data-invalid={!!error}>
        <FieldLabel htmlFor="login-password">كلمة المرور</FieldLabel>
        <Input
          id="login-password"
          ref={passwordRef}
          type="password"
          dir="ltr"
          inputMode="numeric"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          aria-invalid={!!error}
        />
        {error && <FieldError>{error}</FieldError>}
      </Field>

      <Button type="submit" size="lg" disabled={pending || !name.trim() || !password}>
        {pending && <Spinner />}
        دخول
      </Button>
    </form>
  );
}
