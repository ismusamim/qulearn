"use client";

import { useState } from "react";

import { ChevronsUpDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { normalizeArabic, toLatinDigits } from "@/lib/arabic";
import { SURAHS, surahByNumber } from "@/lib/quran";

/** Matches by surah number or by name, ignoring hamza / taa marbuta spelling differences. */
function matches(value: string, search: string): number {
  const query = normalizeArabic(toLatinDigits(search));
  if (!query) return 1;
  return normalizeArabic(value).includes(query) ? 1 : 0;
}

/** Searchable picker over the 114 surahs. */
export function SurahCombobox({
  id,
  value,
  onChange,
  invalid,
}: {
  id?: string;
  value: number;
  onChange: (surah: number) => void;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = surahByNumber(value);

  return (
    // `modal` keeps the list scrollable when the picker sits inside a dialog.
    <Popover open={open} onOpenChange={setOpen} modal>
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
          {current ? `${current.number}. ${current.name} (${current.ayat} آية)` : "اختر السورة"}
          <ChevronsUpDownIcon className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command filter={matches}>
          <CommandInput placeholder="ابحث بالاسم أو الرقم…" />
          <CommandList>
            <CommandEmpty>لا توجد سورة بهذا الاسم</CommandEmpty>
            <CommandGroup>
              {SURAHS.map((surah) => (
                <CommandItem
                  key={surah.number}
                  value={`${surah.number} ${surah.name}`}
                  data-checked={surah.number === value}
                  onSelect={() => {
                    onChange(surah.number);
                    setOpen(false);
                  }}
                >
                  <span className="w-7 text-muted-foreground">{surah.number}</span>
                  {surah.name}
                  <span className="text-xs text-muted-foreground">{surah.ayat} آية</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
