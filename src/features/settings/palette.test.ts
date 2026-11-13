import { describe, expect, it } from "vitest";

import { DEFAULT_THEME, isHexColor } from "@/lib/theme";

import { paletteFromPixels, rgbToHsl, themeOverrides } from "./palette";
import { dataUrlBytes, logoSchema, themeSchema } from "./schemas";

/** Builds RGBA bytes from [r, g, b, a, count] runs. */
function pixels(...runs: Array<[number, number, number, number, number]>): number[] {
  return runs.flatMap(([r, g, b, a, count]) => Array.from({ length: count }, () => [r, g, b, a]).flat());
}

describe("rgbToHsl", () => {
  it("converts primaries and greys", () => {
    expect(rgbToHsl(255, 0, 0)).toEqual({ h: 0, s: 1, l: 0.5 });
    expect(rgbToHsl(0, 255, 0).h).toBe(120);
    expect(rgbToHsl(128, 128, 128).s).toBe(0);
  });
});

describe("paletteFromPixels", () => {
  it("returns nothing for a transparent or colourless image", () => {
    expect(paletteFromPixels([])).toEqual({});
    expect(paletteFromPixels(pixels([10, 20, 200, 0, 50]))).toEqual({});
    expect(paletteFromPixels(pixels([255, 255, 255, 255, 50]))).toEqual({});
  });

  it("picks the dark colour as primary and the mid-tone of another hue as accent", () => {
    const navy: [number, number, number] = [19, 41, 75];
    const gold: [number, number, number] = [184, 144, 79];
    const p = paletteFromPixels(pixels([...navy, 255, 400], [...gold, 255, 200], [255, 255, 255, 255, 1000]));
    expect(p.primary).toBe("#13294b");
    expect(p.accent).toBe("#b8904f");
    expect(isHexColor(p.background)).toBe(true);
    expect(isHexColor(p.text)).toBe(true);
    expect(p.success).toBeUndefined();
  });

  it("darkens a light green for the success colour", () => {
    const p = paletteFromPixels(pixels([19, 41, 75, 255, 100], [120, 200, 120, 255, 100]));
    expect(isHexColor(p.success)).toBe(true);
    expect(rgbToHsl(...hexToRgb(p.success!)).l).toBeLessThanOrEqual(0.39);
  });
});

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

describe("themeOverrides", () => {
  it("keeps only colours that differ from the defaults", () => {
    expect(themeOverrides(DEFAULT_THEME)).toEqual({});
    expect(themeOverrides({ ...DEFAULT_THEME, primary: "#0F6B4F" })).toEqual({ primary: "#0f6b4f" });
  });
});

describe("schemas", () => {
  it("rejects colours that are not #rrggbb", () => {
    expect(themeSchema.safeParse(DEFAULT_THEME).success).toBe(true);
    expect(themeSchema.safeParse({ ...DEFAULT_THEME, accent: "red" }).success).toBe(false);
    expect(themeSchema.safeParse({ ...DEFAULT_THEME, accent: "#fff;}body{display:none" }).success).toBe(false);
  });

  it("accepts small raster data URLs only", () => {
    expect(logoSchema.safeParse({ logo: "data:image/png;base64,AAAA" }).success).toBe(true);
    expect(logoSchema.safeParse({ logo: "data:image/svg+xml;base64,AAAA" }).success).toBe(false);
    expect(logoSchema.safeParse({ logo: "https://example.com/logo.png" }).success).toBe(false);
    expect(logoSchema.safeParse({ logo: "data:image/png;base64," + "A".repeat(300_000) }).success).toBe(false);
    expect(dataUrlBytes("data:image/png;base64,AAAA")).toBe(3);
    expect(dataUrlBytes("data:image/png;base64,AAA=")).toBe(2);
  });
});
