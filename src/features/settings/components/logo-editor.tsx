"use client";

import { useRef, useState } from "react";

import { UploadIcon } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";

import { removeLogoAction, updateLogoAction } from "../actions";
import { resizeLogoFile } from "../logo-image";
import { DEFAULT_LOGO_SRC, LOGO_MAX_BYTES, dataUrlBytes } from "../schemas";

/** Current logo with upload / back-to-default. The upload is resized in the browser before it is sent. */
export function LogoEditor({ logo }: { logo: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const upload = useAction(updateLogoAction, { successMessage: "تم تحديث الشعار — جرّب «استخراج الألوان من الشعار»" });
  const remove = useAction(removeLogoAction, { successMessage: "عاد الشعار الافتراضي" });
  const busy = reading || upload.pending || remove.pending;

  async function onFile(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) {
      toast.error("اختر ملف صورة");
      return;
    }
    setReading(true);
    try {
      const dataUrl = await resizeLogoFile(file);
      if (dataUrlBytes(dataUrl) > LOGO_MAX_BYTES) toast.error("حجم الشعار كبير حتى بعد تصغيره؛ جرّب صورة أبسط");
      else upload.execute({ logo: dataUrl });
    } catch {
      toast.error("تعذّرت قراءة الصورة");
    } finally {
      setReading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <Image
        src={logo ?? DEFAULT_LOGO_SRC}
        alt="الشعار الحالي"
        width={128}
        height={128}
        unoptimized
        className="size-32 rounded-lg border bg-white object-contain p-2"
      />
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          void onFile(file);
        }}
      />
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={() => input.current?.click()}>
          {reading || upload.pending ? <Spinner /> : <UploadIcon />}
          رفع شعار جديد
        </Button>
        {logo && (
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => remove.execute(undefined)}>
            الشعار الافتراضي
          </Button>
        )}
      </div>
      <p className="max-w-xs text-center text-xs text-muted-foreground">
        PNG أو SVG بخلفية شفافة يعطي أفضل نتيجة. يُصغَّر تلقائيًا ويظهر في صفحة الدخول والشريط الجانبي وأيقونة التطبيق.
      </p>
    </div>
  );
}
