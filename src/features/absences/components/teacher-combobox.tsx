"use client";

import { useState } from "react";

import { ChevronsUpDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { normalizeArabic } from "@/lib/arabic";

import type { StaffOption } from "../service";

/** Names starting with the query first, then names with a word starting with it, then any match. */
function rank(name: string, search: string): number {
  const n = normalizeArabic(name);
  const q = normalizeArabic(search);
  if (!q || n.startsWith(q)) return 1;
  if (n.split(" ").some((word) => word.startsWith(q))) return 0.8;
  return n.includes(q) ? 0.5 : 0;
}

/** Type part of a teacher's name and pick from the list (hamza forms and diacritics are ignored). */
export function TeacherCombobox({
  id,
  staff,
  value,
  onChange,
  invalid,
}: {
  id: string;
  staff: StaffOption[];
  value: string;
  onChange: (employee: StaffOption) => void;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = staff.find((s) => s.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid}
          className="w-full justify-between font-normal"
        >
          <span className={selected ? undefined : "text-muted-foreground"}>
            {selected?.name ?? "اكتب جزءًا من الاسم واختر من القائمة"}
          </span>
          <ChevronsUpDownIcon className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
        <Command filter={(itemValue, search) => rank(itemValue, search)}>
          <CommandInput placeholder="ابحث بالاسم…" />
          <CommandList>
            <CommandEmpty>لا يوجد اسم مطابق</CommandEmpty>
            <CommandGroup>
              {staff.map((s) => (
                <CommandItem
                  key={s.id}
                  value={s.name}
                  data-checked={s.id === value}
                  onSelect={() => {
                    onChange(s);
                    setOpen(false);
                  }}
                >
                  {s.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
