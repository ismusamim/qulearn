import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";

import { DirectionProvider } from "@/components/ui/direction";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { themeCssVariables } from "@/lib/theme";
import { getBranding } from "@/server/settings";

import "./globals.css";

// Every page reads the branding (and usually the session) from the database,
// so nothing is prerendered at build time — the build never needs the database.
export const dynamic = "force-dynamic";

const cairo = Cairo({ subsets: ["arabic", "latin"], variable: "--font-sans", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const { org, logo } = await getBranding();
  return { title: { default: org, template: `%s — ${org}` }, icons: { icon: logo, apple: logo } };
}

export async function generateViewport(): Promise<Viewport> {
  const { theme } = await getBranding();
  return { themeColor: theme.primary };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { theme } = await getBranding();
  // Brand colours chosen in Settings override the defaults in globals.css.
  const css = `:root{${Object.entries(themeCssVariables(theme))
    .map(([name, value]) => `${name}:${value}`)
    .join(";")}}`;

  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} h-full antialiased`}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body className="min-h-full bg-background text-foreground">
        <DirectionProvider dir="rtl">
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster theme="light" position="top-center" richColors dir="rtl" />
        </DirectionProvider>
      </body>
    </html>
  );
}
