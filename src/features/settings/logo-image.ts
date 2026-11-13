import type { ThemeColors } from "@/lib/theme";

import { paletteFromPixels } from "./palette";
import { LOGO_MAX_SIDE } from "./schemas";

/** Browser-only helpers for the logo (canvas work). */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

/**
 * Shrinks an uploaded picture so its longest side is at most LOGO_MAX_SIDE and
 * returns it as a data URL (WebP keeps transparency and is small; PNG where the
 * browser cannot encode WebP).
 */
export async function resizeLogoFile(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const width = img.naturalWidth || LOGO_MAX_SIDE;
    const height = img.naturalHeight || LOGO_MAX_SIDE;
    const scale = Math.min(1, LOGO_MAX_SIDE / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const webp = canvas.toDataURL("image/webp", 0.9);
    return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Reads the logo's pixels (sampled at 128×128) and derives brand colours from them. */
export async function extractLogoPalette(src: string): Promise<Partial<ThemeColors>> {
  const img = await loadImage(src);
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(img, 0, 0, size, size);
  return paletteFromPixels(ctx.getImageData(0, 0, size, size).data);
}
