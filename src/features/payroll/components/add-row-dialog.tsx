"use client";

import { type ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";

import { addRowAction } from "../actions";

/** Adds one working employee to an open month at their current prices. */
export function AddRowDialog({
  year,
  month,
  options,
  children,
}: {
  year: number;
  month: number;
  options: { id: string; label: string }[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const add = useAction(addRowAction, {
    successMessage: "تمت إضافة الموظف للشهر",
    onSuccess: () => {
      setOpen(false);
      setEmployeeId("");
    },
  });
  const selected = employeeId || options[0]?.id || "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            add.execute({ year, month, employeeId: selected });
          }}
        >
          <DialogHeader>
            <DialogTitle>إضافة موظف لشهر ({month})</DialogTitle>
          </DialogHeader>
          {options.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              كل الموظفين العاملين موجودون في هذا الشهر (المتوقف يُعاد عاملًا من «الموظفون»).
            </p>
          ) : (
            <Field>
              <FieldLabel htmlFor="add-row-employee">الموظف</FieldLabel>
              <NativeSelect
                id="add-row-employee"
                className="w-full"
                value={selected}
                onChange={(e) => setEmployeeId(e.target.value)}
              >
                {options.map((o) => (
                  <NativeSelectOption key={o.id} value={o.id}>
                    {o.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={add.pending || !selected}>
              {add.pending && <Spinner />}
              إضافة
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
