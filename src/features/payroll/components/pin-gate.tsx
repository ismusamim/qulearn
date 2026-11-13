"use client";

import { useState } from "react";

import { LockKeyholeIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";

import { unlockPayrollAction } from "../actions";

/** Shown instead of the payroll section until the PIN is entered. */
export function PinGate() {
  const [pin, setPin] = useState("");
  // On success the action revalidates the page, which then renders unlocked.
  const unlock = useAction(unlockPayrollAction);

  return (
    <Card className="mx-auto mt-8 max-w-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LockKeyholeIcon className="size-4" />
          قسم المرتبات
        </CardTitle>
        <CardDescription>هذا القسم محمي برمز خاص.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            unlock.execute({ pin });
          }}
        >
          <Field>
            <FieldLabel htmlFor="payroll-pin">الرمز</FieldLabel>
            <Input
              id="payroll-pin"
              type="password"
              dir="ltr"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          </Field>
          <Button type="submit" disabled={unlock.pending || !pin}>
            {unlock.pending && <Spinner />}
            فتح
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
