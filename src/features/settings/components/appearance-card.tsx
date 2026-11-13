import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ThemeColors } from "@/lib/theme";

import { DEFAULT_LOGO_SRC } from "../schemas";
import { LogoEditor } from "./logo-editor";
import { ThemeEditor } from "./theme-editor";

export function AppearanceCard({ logo, theme }: { logo: string | null; theme: ThemeColors }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>المظهر</CardTitle>
        <CardDescription>الشعار والألوان تُطبَّق على التطبيق كله ولكل المستخدمين.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
          <LogoEditor logo={logo} />
          {/* Remount when the stored theme changes so the pickers start from it. */}
          <ThemeEditor key={JSON.stringify(theme)} theme={theme} logoSrc={logo ?? DEFAULT_LOGO_SRC} />
        </div>
      </CardContent>
    </Card>
  );
}
