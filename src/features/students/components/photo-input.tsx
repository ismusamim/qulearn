"use client";

import { useRef } from "react";

import { UserIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { PHOTO_SIZE } from "../student-rules";

/**
 * Crops the chosen picture to a centred square and shrinks it to 160px, so a
 * photo costs a few kilobytes. WebP where the browser can encode it, else JPEG.
 */
function toAvatarDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      canvas.width = canvas.height = PHOTO_SIZE;
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(url);
      if (!ctx) return reject(new Error("no canvas"));
      ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
      let data = canvas.toDataURL("image/webp", 0.72);
      if (!data.startsWith("data:image/webp")) data = canvas.toDataURL("image/jpeg", 0.75);
      resolve(data);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("unreadable"));
    };
    img.src = url;
  });
}

export function PhotoInput({ value, onChange }: { value: string | null; onChange: (value: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      onChange(await toAvatarDataUrl(file));
    } catch {
      toast.error("تعذّرت قراءة الصورة");
    }
  };

  return (
    <div className="flex shrink-0 flex-col items-center gap-2">
      <div className="flex size-28 items-center justify-center overflow-hidden rounded-xl border bg-muted text-muted-foreground">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- a data URL; next/image adds nothing
          <img src={value} alt="صورة الطالب" className="size-full object-cover" />
        ) : (
          <UserIcon className="size-12" />
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <div className="flex gap-1">
        <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
          صورة
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={!value} onClick={() => onChange(null)}>
          إزالة
        </Button>
      </div>
    </div>
  );
}
