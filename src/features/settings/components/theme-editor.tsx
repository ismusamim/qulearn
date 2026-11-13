"use client";

import { useEffect, useState } from "react";

import { PipetteIcon, RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import { DEFAULT_THEME, THEME_FIELDS, THEME_PRESETS, type ThemeColors, isHexColor, themeCssVariables } from "@/lib/theme";

import { resetAppearanceAction, updateThemeAction } from "../actions";
import { extractLogoPalette } from "../logo-image";
import { ThemePreview } from "./theme-preview";

const sameColors = (a: ThemeColors, b: ThemeColors) => THEME_FIELDS.every(({ key }) => a[key].toLowerCase() === b[key].toLowerCase());

/**
 * Colour pickers, ready-made presets and «استخراج الألوان من الشعار». Changes
 * are previewed on the whole page at once but stored only on «حفظ الألوان».
 */
export function ThemeEditor({ theme, logoSrc }: { theme: ThemeColors; logoSrc: string }) {
  const [colors, setColors] = useState<ThemeColors>(theme);
  const [extracting, setExtracting] = useState(false);
  const dirty = !sameColors(colors, theme);

  // Live preview: override the CSS variables of the root layout while there are
  // unsaved changes; removing them falls back to the saved theme.
  useEffect(() => {
    if (!dirty) return;
    const root = document.documentElement;
    const variables = themeCssVariables(colors);
    for (const [name, value] of Object.entries(variables)) root.style.setProperty(name, value);
    return () => {
      for (const name of Object.keys(variables)) root.style.removeProperty(name);
    };
  }, [colors, dirty]);

  const save = useAction(updateThemeAction, { successMessage: "تم حفظ الألوان" });
  const reset = useAction(resetAppearanceAction, {
    successMessage: "عاد المظهر الافتراضي",
    onSuccess: () => setColors(DEFAULT_THEME),
  });

  async function fromLogo() {
    setExtracting(true);
    try {
      const palette = await extractLogoPalette(logoSrc);
      if (Object.keys(palette).length === 0) toast.error("لم أجد ألوانًا واضحة في الشعار");
      else {
        setColors((current) => ({ ...current, ...palette }));
        toast.success("تم تطبيق ألوان الشعار — راجعها ثم احفظ");
      }
    } catch {
      toast.error("تعذّر تحليل ألوان الشعار");
    } finally {
      setExtracting(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {THEME_FIELDS.map(({ key, label, hint }) => (
          <label key={key} className="flex cursor-pointer items-center gap-3 rounded-lg border bg-card p-2">
            <input
              type="color"
              value={colors[key]}
              onChange={(e) => {
                const value = e.target.value;
                if (isHexColor(value)) setColors((current) => ({ ...current, [key]: value }));
              }}
              className="size-10 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{label}</span>
              <span className="block text-xs text-muted-foreground">{hint}</span>
            </span>
          </label>
        ))}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">أنماط جاهزة</h3>
        <div className="flex flex-wrap gap-2">
          {THEME_PRESETS.map((preset) => {
            const full = { ...DEFAULT_THEME, ...preset.colors };
            return (
              <Button key={preset.name} type="button" variant="outline" size="sm" onClick={() => setColors(full)}>
                <span className="flex overflow-hidden rounded-sm border" aria-hidden>
                  {[full.primary, full.accent, full.background].map((value, i) => (
                    <span key={i} className="block h-3.5 w-3" style={{ backgroundColor: value }} />
                  ))}
                </span>
                {preset.name}
              </Button>
            );
          })}
          <Button type="button" variant="outline" size="sm" disabled={extracting} onClick={() => void fromLogo()}>
            {extracting ? <Spinner /> : <PipetteIcon />}
            استخراج الألوان من الشعار
          </Button>
        </div>
      </div>

      <ThemePreview />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" disabled={!dirty || save.pending} onClick={() => save.execute(colors)}>
          {save.pending && <Spinner />}
          حفظ الألوان
        </Button>
        <Button type="button" variant="outline" disabled={!dirty || save.pending} onClick={() => setColors(theme)}>
          تراجع
        </Button>
        <ConfirmDialog
          title="استعادة الألوان والشعار الافتراضيين؟"
          description="تعود الألوان الأصلية ويُحذف الشعار المرفوع."
          confirmLabel="استعادة"
          destructive
          onConfirm={() => reset.execute(undefined)}
        >
          <Button type="button" variant="destructive" disabled={reset.pending} className="ms-auto">
            {reset.pending ? <Spinner /> : <RotateCcwIcon />}
            استعادة المظهر الافتراضي
          </Button>
        </ConfirmDialog>
      </div>
      {dirty && <p className="text-xs text-warning">معاينة فقط — لم تُحفظ الألوان بعد.</p>}
    </div>
  );
}
