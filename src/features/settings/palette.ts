import { DEFAULT_THEME, type ThemeColors, mixColors } from "@/lib/theme";

/**
 * Derives brand colours from the pixels of the logo: the darkest saturated
 * colour becomes the primary, the most prominent mid-tone the accent (and a
 * very light tint of it the background), and a green — if the logo has one —
 * the «حاضر» colour.
 */

interface Swatch {
  hex: string;
  /** Number of pixels in the bucket. */
  n: number;
  /** Hue 0–360, saturation and lightness 0–1. */
  h: number;
  s: number;
  l: number;
}

const toHex = (rgb: number[]) =>
  "#" + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  return { h: (h + 360) % 360, s, l };
}

/** Darkens a light colour so white text on top of it stays readable. */
function deepen(x: Swatch): string {
  if (x.l <= 0.42 && x.s >= 0.35) return x.hex;
  const s = Math.max(x.s, 0.4);
  const l = Math.min(x.l, 0.38);
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const k = c * (1 - Math.abs(((x.h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    x.h < 60 ? [c, k, 0] : x.h < 120 ? [k, c, 0] : x.h < 180 ? [0, c, k] : x.h < 240 ? [0, k, c] : x.h < 300 ? [k, 0, c] : [c, 0, k];
  return toHex([r, g, b].map((v) => (v + m) * 255));
}

/**
 * @param pixels RGBA bytes (as returned by `CanvasRenderingContext2D.getImageData().data`).
 * @returns only the colours that could be determined; empty when the image has no clear colours.
 */
export function paletteFromPixels(pixels: ArrayLike<number>): Partial<ThemeColors> {
  // Group pixels into 4-bit-per-channel buckets and average each bucket.
  const buckets = new Map<number, [number, number, number, number]>();
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 200) continue; // transparent background
    const key = ((pixels[i] >> 4) << 8) | ((pixels[i + 1] >> 4) << 4) | (pixels[i + 2] >> 4);
    const b = buckets.get(key) ?? [0, 0, 0, 0];
    b[0] += pixels[i];
    b[1] += pixels[i + 1];
    b[2] += pixels[i + 2];
    b[3]++;
    buckets.set(key, b);
  }
  const swatches: Swatch[] = [...buckets.values()]
    .map(([r, g, b, n]) => ({ hex: toHex([r / n, g / n, b / n]), n, ...rgbToHsl(r / n, g / n, b / n) }))
    .sort((a, b) => b.n - a.n);

  const hueDistance = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
  // Most widespread, preferring saturated colours over greys.
  const spread = (x: Swatch) => x.n * (0.25 + x.s);
  const vivid = (x: Swatch) => x.n * x.s * x.s;
  const best = (filter: (x: Swatch) => boolean, weight: (x: Swatch) => number = spread): Swatch | undefined =>
    swatches.filter(filter).sort((a, b) => weight(b) - weight(a))[0];

  const primary = best((x) => x.l < 0.36 && x.s > 0.12, vivid) ?? best((x) => x.l < 0.42);
  const accent = best(
    (x) => x.l >= 0.3 && x.l <= 0.65 && x.s > 0.25 && (!primary || hueDistance(x.h, primary.h) > 30),
    vivid,
  );
  const green = best((x) => x.h >= 75 && x.h <= 165 && x.s > 0.14 && x.l > 0.18 && x.l < 0.7, vivid);

  const out: Partial<ThemeColors> = {};
  if (primary) {
    out.primary = primary.hex;
    out.text = mixColors(primary.hex, "#000000", 0.3);
  }
  if (accent) {
    out.accent = accent.hex;
    out.background = mixColors(accent.hex, "#ffffff", 0.93);
  }
  if (green) out.success = deepen(green);
  return out;
}

/** The colours worth storing: only those that differ from the built-in theme. */
export function themeOverrides(colors: ThemeColors): Partial<ThemeColors> {
  const out: Partial<ThemeColors> = {};
  for (const key of Object.keys(DEFAULT_THEME) as Array<keyof ThemeColors>) {
    const value = colors[key].toLowerCase();
    if (value !== DEFAULT_THEME[key].toLowerCase()) out[key] = value;
  }
  return out;
}
